import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import { getStepSettings } from '../steps/step-id'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { shouldCollectStateData } from './state-util'
import { EntityNetid } from '../misc/entity-netid'
import { Username } from '../net/binary/binary-types'

interface StepObj {
    settings: any // ig.EventStepBase.Settings
    data?: Record<string, unknown>
}

interface StepGroupBase {
    steps: StepObj[]
    type: ig.EventRunType
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

function serializeStepGroup(group: StepGroupDeserialized): StepGroupSerialized {
    if (group.callEntity) {
        assert(group.callEntity.netid)
        group.callEntity = group.callEntity.netid as any
    }

    for (const step of group.steps) {
        let data = (step.data = { ...step.data })
        if (data && typeof data == 'object') {
            for (const key in data) {
                const value = data[key]
                if (value && typeof value === 'object' && value instanceof ig.Class) {
                    if (value instanceof ig.Entity) {
                        assert(value.netid)
                        data[key] = { netid: value.netid }
                    } else if (value instanceof multi.class.InputFieldDialog || value instanceof ig.Action) {
                        data[key] = undefined
                    } else {
                        assert(false)
                    }
                }
            }
        }

        /* remove branch step settings */
        for (let i = 0; step.settings[i]; i++) {
            delete step.settings[i]
        }
    }
    return group as StepGroupSerialized
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
        if (data && typeof data == 'object') {
            for (const key in data) {
                const value = data[key]
                if (value && typeof value === 'object' && 'netid' in value) {
                    const netid = value.netid as EntityNetid
                    const entity = ig.game.entitiesByNetid[netid]
                    assert(entity)
                    data[key] = entity
                }
            }
        }
    }
    return group as StepGroupDeserialized
}

function runSteps(steps: StepGroupSerialized[], inst: InstanceinatorInstance) {
    const stepGroups = steps.map(deserializeStepGroup)
    runTask(inst, () => {
        for (const { steps, type, callEntity } of stepGroups) {
            const allData = {}
            const stepsSettings = steps.map(({ settings }) => settings)

            for (const { data } of steps) Object.assign(allData, data)

            const event = new ig.Event({ steps: stepsSettings })

            const eventCall = new ig.EventCall(event, allData, type)
            eventCall.callEntity = callEntity
            eventCall.stack[0].stepData = allData
            // console.log( 'pushing event call to:', instanceinator.id, ', steps:', stepsSettings.map(({ type }) => type), 'call:', eventCall)

            if (!ig.game.events.blockingEventCall || type != ig.EventRunType.BLOCKING) {
                ig.game.events._startEventCall(eventCall)
            } else {
                eventCall.blocked = true
                ig.game.events.blockedEventCallQueue.push(eventCall)
            }
            ig.game.events.update()
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

            ig.EVENT_STEP.START_NPC_TRADE_MENU,

            ig.EVENT_STEP.SHOW_INPUT_DIALOG,
        ].map(clazz => clazz.classId)
    )
}, 2000)

interface EventStepHistoryEntry {
    step: ig.EventStepBase
    data: Record<string, unknown>
    call: ig.EventCall
}

declare global {
    namespace ig {
        interface EventCall {
            whitelistStepHistory?: EventStepHistoryEntry[]
        }
    }
}

export function onEventStepStart(call: ig.EventCall, step: ig.EventStepBase, data: Record<string, unknown>) {
    if (!eventStepWhitelist.has(step.classId) || !shouldCollectStateData()) return

    call.whitelistStepHistory ??= []
    const entry: EventStepHistoryEntry = { step, data, call }
    call.whitelistStepHistory.push(entry)

    ig.eventStepsFired ??= new Map()
    let group = ig.eventStepsFired.get(call)
    if (!group) {
        group = { steps: [], type: call.runType, callEntity: call.callEntity }
        ig.eventStepsFired.set(call, group)
    }
    group.steps.push({
        settings: getStepSettings(step) as ig.EventStepBase.Settings,
        data,
    })
}
