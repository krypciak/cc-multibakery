import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { shouldCollectStateData } from './state-util'
import type { EntityNetid } from '../misc/entity-netid'
import type { Username } from '../net/binary/binary-types'
import { runEvent } from '../steps/event-steps-run'
import { isRemote } from '../server/remote/is-remote-server'

interface StepObj {
    settings: any // ig.EventStepBase.Settings
    data?: Record<string, unknown>
    input?: ig.Event.Vars
}

interface StepGroupBase {
    steps: StepObj[]
    type: ig.EventRunType
    eventCallId: number
    end: boolean
}

interface StepGroupDeserialized extends StepGroupBase {
    callEntity?: ig.Entity
}

interface StepGroupSerialized extends StepGroupBase {
    callEntity?: EntityNetid
}

interface StepArray {
    map?: StepGroupSerialized[]
    clients?: Record<Username, StepGroupSerialized[]>
}

type StepsFiredMap = Map<ig.EventCall, StepGroupDeserialized>
declare global {
    interface StateUpdatePacket {
        eventSteps?: StepArray
    }
    namespace ig {
        var eventStepsFired: StepsFiredMap | undefined
    }
}

function serializeStepSettingsRecursive(data: any) {
    if (data && typeof data == 'object') {
        for (const key in data) {
            const value = data[key]
            if (!value) continue
            if (typeof value === 'object') {
                if (value instanceof ig.Class) {
                    if (value instanceof ig.Entity) {
                        assert(value.netid)
                        data[key] = { netid: value.netid }
                    } else if (value instanceof sc.InputFieldDialog || value instanceof ig.Action) {
                        data[key] = undefined
                    } else {
                        assert(false)
                    }
                } else {
                    serializeStepSettingsRecursive(value)
                }
            } else if (typeof value == 'function') {
                data[key] = undefined
            }
        }
    }
}

function serializeStepGroup(group: StepGroupDeserialized): StepGroupSerialized {
    group = ig.copy(group)
    if (group.callEntity) {
        assert(group.callEntity.netid)
        group.callEntity = group.callEntity.netid as any
    }

    for (const step of group.steps) {
        serializeStepSettingsRecursive(step.data)

        /* remove branch step settings */
        for (let i = 0; step.settings[i]; i++) {
            delete step.settings[i]
        }
        /* from ig.EVENT_STEP.SHOW_INPUT_DIALOG */
        if (step.settings.accepted) step.settings.accepted = []

        serializeStepSettingsRecursive(step.settings)
    }
    return group as StepGroupSerialized
}

function deserializeStepSettingsRecursive(data: any) {
    if (data && typeof data == 'object') {
        for (const key in data) {
            const value = data[key]
            if (value && typeof value === 'object') {
                if ('netid' in value) {
                    const netid = value.netid as EntityNetid
                    const entity = ig.game.entitiesByNetid[netid]
                    assert(entity)
                    data[key] = entity
                } else {
                    deserializeStepSettingsRecursive(value)
                }
            }
        }
    }
}

function deserializeStepGroup(group: StepGroupSerialized): StepGroupDeserialized {
    if (group.callEntity) {
        const netid = group.callEntity as unknown as EntityNetid
        const entity = ig.game.entitiesByNetid[netid]
        assert(entity)
        group.callEntity = entity as any
    }

    for (const step of group.steps) {
        const data = step.data as Record<string, unknown>
        deserializeStepSettingsRecursive(data)
        deserializeStepSettingsRecursive(step.settings)
    }
    return group as StepGroupDeserialized
}

const eventCallMemory: Map<number, { eventAttached: ig.EventCall.EventAttached[] }> = new Map()
let forceSetDone = false

function runSteps(steps: StepGroupSerialized[], inst: InstanceinatorInstance) {
    const stepGroups = steps.map(deserializeStepGroup)
    runTask(inst, () => {
        for (const { steps, type, callEntity, eventCallId, end } of stepGroups) {
            const allData: Record<string, unknown> = {}
            const allInput: ig.Event.Vars = {}
            const stepsSettings = steps.map(({ settings }) => settings)

            for (const { data, input } of steps) {
                Object.assign(allData, data)
                Object.assign(allInput, input)
            }

            const call = runEvent(new ig.Event({ steps: stepsSettings }), type, callEntity, allData, allInput)
            if (eventCallMemory.has(eventCallId)) {
                const { eventAttached } = eventCallMemory.get(eventCallId)!
                call.eventAttached = eventAttached
            } else {
                eventCallMemory.set(eventCallId, {
                    eventAttached: call.eventAttached,
                })
            }
            ig.game.events.update()

            if (end) {
                forceSetDone = true
                call.setDone()
                forceSetDone = false
            }
        }
    })
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            const mapSteps = ig.eventStepsFired
            if (mapSteps && mapSteps.size > 0) {
                //     packet.steps ??= {}
                //     packet.steps.map = [...mapSteps.values()].map(serializeStepGroup)
                ig.eventStepsFired?.clear()
            }

            if (client) {
                const clientSteps = client.inst.ig.eventStepsFired
                if (clientSteps && clientSteps.size > 0) {
                    packet.eventSteps ??= {}
                    packet.eventSteps.clients ??= {}
                    packet.eventSteps.clients[client.username] = [...clientSteps.values()].map(serializeStepGroup)
                    clientSteps.clear()
                }
            }
        },
        set(packet) {
            if (!packet.eventSteps) return

            // if (packet.steps.map) {
            //     assert(ig.ccmap)
            //     runSteps(packet.steps.map, ig.ccmap.inst)
            // }

            if (packet.eventSteps.clients) {
                for (const username in packet.eventSteps.clients) {
                    const client = multi.server.clients.get(username)
                    if (!client) {
                        console.warn(`steps.ts client not found!: "${username}"`)
                        continue
                    }

                    runSteps(packet.eventSteps.clients[username], client.inst)
                }
            }
        },
    })
}, 99) /* this needs to run before game-model-state, otherwise it will crash on dialog cutscene skip */

let eventStepWhitelist: Set<number>
prestart(() => {
    eventStepWhitelist = new Set(
        [
            ig.EVENT_STEP.ADD_MSG_PERSON,
            ig.EVENT_STEP.SHOW_MSG,
            ig.EVENT_STEP.CLEAR_MSG,
            ig.EVENT_STEP.SHOW_SIDE_MSG,
            ig.EVENT_STEP.SHOW_BOARD_MSG,
            ig.EVENT_STEP.SHOW_CHOICE,
            ig.EVENT_STEP.SHOW_TUTORIAL_MSG,
            ig.EVENT_STEP.SHOW_GET_MSG,
            ig.EVENT_STEP.SHOW_CENTER_MSG,
            ig.EVENT_STEP.SHOW_DREAM_MSG,

            ig.EVENT_STEP.SET_CAMERA_TARGET,
            ig.EVENT_STEP.SET_CAMERA_POS,
            ig.EVENT_STEP.SET_CAMERA_BETWEEN,
            ig.EVENT_STEP.RESET_CAMERA,
            ig.EVENT_STEP.UNDO_CAMERA,
            ig.EVENT_STEP.SET_CAMERA_ZOOM,
            ig.EVENT_STEP.ADD_PLAYER_CAMERA_TARGET,
            ig.EVENT_STEP.REMOVE_PLAYER_CAMERA_TARGET,
            ig.EVENT_STEP.REMOVE_ALL_PLAYER_CAMERAS,

            ig.EVENT_STEP.SET_SCREEN_BLUR,
            ig.EVENT_STEP.CLEAR_SCREEN_BLUR,
            ig.EVENT_STEP.SET_ZOOM_BLUR,
            ig.EVENT_STEP.FADE_OUT_ZOOM_BLUR,

            ig.EVENT_STEP.SET_OVERLAY,
            ig.EVENT_STEP.SHOW_AR_MSG,

            ig.EVENT_STEP.START_NPC_TRADE_MENU,

            ig.EVENT_STEP.SHOW_INPUT_DIALOG,
        ].map(clazz => clazz.classId)
    )
}, 2000)

declare global {
    namespace ig {
        interface EventCall {
            eventCallId: number
        }
        var ignoreEventStepsCollection: boolean | undefined
    }
}

function getGroup(call: ig.EventCall) {
    ig.eventStepsFired ??= new Map()
    let group = ig.eventStepsFired.get(call)
    if (!group) {
        group = {
            steps: [],
            type: call.runType,
            callEntity: call.callEntity,
            eventCallId: call.eventCallId,
            end: false,
        }
        ig.eventStepsFired.set(call, group)
    }
    return group
}

export function onEventStepStart(
    call: ig.EventCall,
    { currentStep: step, stepData: data, vars }: ig.EventCall.StackEntry
) {
    if (!step || !eventStepWhitelist.has(step.classId) || !shouldCollectStateData() || ig.ignoreEventStepsCollection)
        return

    const group = getGroup(call)
    assert(group.eventCallId == call.eventCallId)
    group.steps.push({
        settings: ig.StepHelpers.getStepSettings(step) as ig.EventStepBase.Settings,
        data,
        input: vars,
    })
}

prestart(() => {
    if (!PHYSICSNET) return

    let eventCallIdCounter = 0
    ig.EventCall.inject({
        init(...args) {
            this.parent(...args)
            this.eventCallId = eventCallIdCounter++
        },
        setDone() {
            if (!shouldCollectStateData() || this.eventAttached.length == 0) return this.parent()
            this.parent()
            const group = getGroup(this)
            group.end = true
        },
    })
})

prestart(() => {
    if (!REMOTE) return
    ig.EventCall.inject({
        setDone() {
            if (!isRemote(multi.server) || this.eventAttached.length == 0 || forceSetDone) return this.parent()
        },
    })
})
