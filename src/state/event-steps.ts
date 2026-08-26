import { runTask } from 'cc-instanceinator/src/inst-util'
import type { EntityNetid } from '../misc/entity-netid'
import {
    deserializeStepSettingsRecursive,
    getInstFromInstPlayerNetid,
    serializeStepSettingsRecursive,
} from './step-settings-serializer'
import { getDeserializedEventFromEventId, type EventId } from './event-serializer'
import type { i24 } from 'ts-binarifier/src/type-aliases'
import { pushOrderedEvent, registerOrderedEvent } from './ordered-events'
import { prestart } from '../loading-stages'
import { shouldCollectStateData } from './state-util'

export type EventCallId = i24

const uniqueIdOffsest = 100000

declare global {
    interface MapStateOrderedEvents {
        eventCallStart: {
            type: 'eventCallStart'

            eventId: EventId
            instPlayerNetid?: EntityNetid

            eventCallId: number
            runType: ig.EventRunType
            callEntityNetid?: EntityNetid
            data?: Record<string, unknown>
            input?: ig.Event.Vars
        }
    }
}

registerOrderedEvent('eventCallStart', {
    set({ eventId, instPlayerNetid, eventCallId, runType, callEntityNetid, data, input }) {
        const inst = getInstFromInstPlayerNetid(instPlayerNetid)
        const event = getDeserializedEventFromEventId(eventId)
        const callEntity = callEntityNetid ? ig.game.entitiesByNetid[callEntityNetid] : undefined

        const deserializedData = deserializeStepSettingsRecursive(data)

        runTask(inst, () => {
            const eventCall = new ig.EventCall(event, input, runType, null, null, callEntity, deserializedData)
            eventCall.uniqueId = eventCallId + uniqueIdOffsest
            console.log('eventCall!', eventCall)
        })
    },
})
prestart(() => {
    if (!PHYSICSNET) return

    ig.EventManager.inject({
        callEvent(event, runType, onStart, onEnd, input, callEntity, data) {
            const eventCall = this.parent(event, runType, onStart, onEnd, input, callEntity, data)
            if (!shouldCollectStateData()) return eventCall

            pushOrderedEvent({
                type: 'eventCallStart',

                eventId: event.uniqueId,
                instPlayerNetid: ig.client?.dummy?.netid,

                eventCallId: eventCall.uniqueId,
                runType,
                callEntityNetid: callEntity?.netid,
                data: serializeStepSettingsRecursive(data),
                input: input as ig.Event.Vars ?? undefined,
            })

            return eventCall
        },
    })
})

declare global {
    namespace ig {
        interface EventCall {
            uniqueId: EventCallId
        }
    }
}

prestart(() => {
    if (!PHYSICSNET) return
    let eventCallIdCounter = 0
    ig.EventCall.inject({
        init(...args) {
            this.uniqueId = eventCallIdCounter++
            this.parent(...args)
        },
    })
})

//     data: serializeStepSettingsRecursive(step.data),
// deserializeStepSettingsRecursive(data)

// const eventCallMemory: Map<number, { eventAttached: ig.EventCall.EventAttached[] }> = new Map()
// let forceSetDone = false
//
// function runSteps(steps: StepGroupSerialized[], inst: InstanceinatorInstance) {
//     const stepGroups = steps.map(deserializeStepGroup)
//     runTask(inst, () => {
//         for (const { eventId, steps, type, callEntity, eventCallId, end } of stepGroups) {
//             const allData: Record<string, unknown> = {}
//             const allInput: ig.Event.Vars = {}
//             // steps.map(step => step.stepIndex)
//
//             const event = getDeserializedEventFromEventId(eventId)
//
//             for (const { data, input } of steps) {
//                 Object.assign(allData, data)
//                 Object.assign(allInput, input)
//             }
//
//             const call = runEvent({
//                 event,
//                 type,
//                 callEntity,
//                 allData,
//                 allInput,
//             })
//             if (eventCallMemory.has(eventCallId)) {
//                 const { eventAttached } = eventCallMemory.get(eventCallId)!
//                 call.eventAttached = eventAttached
//             } else {
//                 eventCallMemory.set(eventCallId, {
//                     eventAttached: call.eventAttached,
//                 })
//             }
//             ig.game.events.update()
//
//             if (end) {
//                 forceSetDone = true
//                 call.setDone()
//                 forceSetDone = false
//             }
//         }
//     })
// }

// export const eventStepsMapStateHandler: MapStateHandler = {
//     get(packet, player) {
//         const mapSteps = ig.eventStepsFired
//         if (mapSteps && mapSteps.size > 0) {
//             //     packet.steps ??= {}
//             //     packet.steps.map = [...mapSteps.values()].map(serializeStepGroup)
//             ig.eventStepsFired?.clear()
//         }
//
//         if (player?.getClient(true)) {
//             const clientSteps = player.getClient().inst.ig.eventStepsFired
//             if (clientSteps && clientSteps.size > 0) {
//                 packet.eventSteps ??= {}
//                 packet.eventSteps.clients ??= {}
//                 packet.eventSteps.clients[player.username] = [...clientSteps.values()].map(serializeStepGroup)
//                 clientSteps.clear()
//             }
//         }
//     },
//     set(packet) {
//         if (!packet.eventSteps) return
//
//         // if (packet.steps.map) {
//         //     assert(ig.ccmap)
//         //     runSteps(packet.steps.map, ig.ccmap.inst)
//         // }
//
//         if (packet.eventSteps.clients) {
//             // console.log(packet.eventSteps.clients)
//             for (const username in packet.eventSteps.clients) {
//                 const client = multi.server.clients.get(username)
//                 if (!client) {
//                     console.warn(`steps.ts client not found!: "${username}"`)
//                     continue
//                 }
//
//                 runSteps(packet.eventSteps.clients[username], client.inst)
//             }
//         }
//     },
// }
//
// declare global {
//     namespace ig {
//         interface EventCall {
//             ignoreEventStepsCollection?: boolean
//         }
//     }
// }
//
// function getGroup(call: ig.EventCall) {
//     ig.eventStepsFired ??= new Map()
//     let group = ig.eventStepsFired.get(call)
//     if (!group) {
//         const eventId = call.event.uniqueId
//         assert(eventId !== undefined)
//         group = {
//             eventId,
//             steps: [],
//             type: call.runType,
//             callEntity: call.callEntity,
//             eventCallId: call.eventCallId,
//             end: false,
//         }
//         ig.eventStepsFired.set(call, group)
//     }
//     return group
// }

// export function onEventStepStart(
//     call: ig.EventCall,
//     { currentStep: step, stepData: data, vars }: ig.EventCall.StackEntry
// ) {
//     if (
//         !step ||
//         !eventStepWhitelist.has(step.classId) ||
//         !shouldCollectStateData() ||
//         call.ignoreEventStepsCollection
//     ) {
//         return
//     }
//
//     const group = getGroup(call)
//     assert(group.eventCallId == call.eventCallId)
//     group.steps.push({
//         settings: ig.StepHelpers.getStepSettings(step) as ig.EventStepBase.Settings,
//         data,
//         input: vars,
//     })
// }

// prestart(() => {
//     if (!PHYSICSNET) return
//
//     let eventCallIdCounter = 0
//     ig.EventCall.inject({
//         init(...args) {
//             this.parent(...args)
//             this.eventCallId = eventCallIdCounter++
//         },
//         setDone() {
//             this.parent()
//             if (!shouldCollectStateData()) return
//             const group = getGroup(this)
//             group.end = true
//         },
//     })
// })
//
// prestart(() => {
//     if (!REMOTE) return
//     ig.EventCall.inject({
//         setDone() {
//             if (!isRemote(multi.server) || forceSetDone) return this.parent()
//         },
//     })
// })
