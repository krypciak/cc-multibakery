import { prestart } from '../plugin'
import { addStateHandler } from './states'
import { StepHistoryEntry } from '../steps/event-call-history'
import { cleanRecord } from './state-util'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { stepList } from '../steps/step-id'
import { assert } from '../misc/assert'

interface StepObj {
    stepId: number
    data?: Record<string, unknown>
}

interface StepGroup {
    steps: StepObj[]
    type: ig.EventRunType
    callEntity?: ig.Entity
}

interface StepArray {
    map?: StepGroup[]
    clients?: Record<string, StepGroup[]>
}

type StepsFiredMap = Map<ig.EventCall, StepGroup>
declare global {
    interface StateUpdatePacket {
        steps?: StepArray
    }
    namespace ig {
        var stepsFired: StepsFiredMap | undefined
    }
}

function serializeStepGroup(group: StepGroup): StepGroup {
    if (group.callEntity) {
        assert(group.callEntity.netid)
        group.callEntity = group.callEntity.netid as any
    }

    for (const { data } of group.steps) {
        if (data && typeof data == 'object') {
            for (const key in data) {
                const value = data[key]
                if (value && typeof value === 'object' && 'classId' in value) {
                    if (value instanceof ig.Entity) {
                        assert(value.netid)
                        data[key] = { netid: value.netid }
                    }
                }
            }
        }
    }
    return group
}

function deserializeStepGroup(group: StepGroup): StepGroup {
    if (group.callEntity) {
        const netid = group.callEntity as unknown as string
        const entity = ig.game.entitiesByNetid[netid]
        assert(entity)
        group.callEntity = entity
        // TODO: add npc as net entity
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
    return group
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            const mapSteps = ig.stepsFired
            if (mapSteps && mapSteps.size > 0) {
                packet.steps ??= {}
                packet.steps.map = [...mapSteps.values()]
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

            if (!cleanRecord(packet.steps)) return

            // console.log(JSON.stringify(packet.steps, null, 4))
            if (packet.steps.clients) {
                for (const username in packet.steps.clients) {
                    const client = multi.server.clients[username]
                    if (!client) {
                        console.warn(`steps.ts client not found!: "${username}"`)
                        continue
                    }

                    const stepGroups = packet.steps.clients[username].map(deserializeStepGroup)
                    runTask(client.inst, () => {
                        for (const { steps, type, callEntity } of stepGroups) {
                            const allData = {}
                            const stepsSettings = steps.map(({ stepId, data }) => {
                                Object.assign(allData, data)
                                const stepEntry = stepList[stepId]
                                assert(stepEntry)
                                return stepEntry.settings
                            }) as ig.EventStepBase.Settings[]

                            const event = new ig.Event({ steps: stepsSettings })

                            const eventCall = new ig.EventCall(event, allData, type)
                            eventCall.callEntity = callEntity
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
        stepId: step.stepId,
        data,
    })
}
