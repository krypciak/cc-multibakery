import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { StepHistoryEntry } from '../steps/event-call-history'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../misc/assert'
import { getStepSettings } from '../steps/step-id'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

interface StepObj {
    settings: ig.EventStepBase.Settings
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
    callEntity?: string
}

interface StepArray {
    map?: StepGroupSerialized[]
    clients?: Record<string, StepGroupSerialized[]>
}

type StepsFiredMap = Map<ig.EventCall, StepGroupDeserialized>
declare global {
    interface StateUpdatePacket {
        steps?: StepArray
    }
    namespace ig {
        var stepsFired: StepsFiredMap | undefined
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
                if (value && typeof value === 'object' && 'classId' in value) {
                    if (value instanceof ig.Entity) {
                        assert(value.netid)
                        data[key] = { netid: value.netid }
                    } else if (value instanceof multi.class.InputFieldDialog) {
                        data[key] = undefined
                    } else {
                        assert(false)
                    }
                }
            }
        }
    }
    return group as StepGroupSerialized
}

function deserializeStepGroup(group: StepGroupSerialized): StepGroupDeserialized {
    if (group.callEntity) {
        const netid = group.callEntity as unknown as string
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
                    const netid = value.netid as string
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
        }
    })
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            const mapSteps = ig.stepsFired
            if (mapSteps && mapSteps.size > 0) {
                //     packet.steps ??= {}
                //     packet.steps.map = [...mapSteps.values()].map(serializeStepGroup)
                ig.stepsFired?.clear()
            }

            if (player) {
                const clientSteps = player.getClient().inst.ig.stepsFired
                if (clientSteps && clientSteps.size > 0) {
                    packet.steps ??= {}
                    packet.steps.clients ??= {}
                    packet.steps.clients[player.username] = [...clientSteps.values()].map(serializeStepGroup)
                    clientSteps.clear()
                }
            }
        },
        set(packet) {
            if (!packet.steps) return

            // if (packet.steps.map) {
            //     assert(ig.ccmap)
            //     runSteps(packet.steps.map, ig.ccmap.inst)
            // }

            if (packet.steps.clients) {
                for (const username in packet.steps.clients) {
                    const client = multi.server.clients.get(username)
                    if (!client) {
                        console.warn(`steps.ts client not found!: "${username}"`)
                        continue
                    }

                    runSteps(packet.steps.clients[username], client.inst)
                }
            }
        },
    })
})

export function onStepHistoryAdd({ step, data, call }: StepHistoryEntry) {
    ig.stepsFired ??= new Map()
    let group = ig.stepsFired.get(call)
    if (!group) {
        group = { steps: [], type: call.runType, callEntity: call.callEntity }
        ig.stepsFired.set(call, group)
    }
    group.steps.push({
        settings: getStepSettings(step) as ig.EventStepBase.Settings,
        data,
    })
}
