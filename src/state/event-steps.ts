import { runTask } from 'cc-instanceinator/src/inst-util'
import type { EntityNetid } from '../misc/entity-netid'
import {
    deserializeStepSettingsRecursive,
    getInstFromInstPlayerNetid,
    serializeStepSettingsRecursive,
} from './step-settings-serializer'
import {
    deserializeEventStepSettings,
    isStepClassIdInEventStepWhitelist,
    serializeEventStepSettings,
    type SerializedStepSettings,
} from './event-serializer'
import type { i24 } from 'ts-binarifier/src/type-aliases'
import { pushOrderedEvent, registerOrderedEvent } from './ordered-events'
import { prestart } from '../loading-stages'
import { shouldCollectStateData, StateMemory } from './state-util'
import { isRemote } from '../server/remote/remote-server-types'
import type { MapStateHandler, StateKey } from './map-state-handlers'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { addEventStepStartListener } from '../steps/event-call-history'

export type EventCallId = i24

declare global {
    namespace ig {
        interface EventCall {
            uniqueId: EventCallId
            event: ig.Event
            ignoreEventStepsCollection?: boolean
        }
    }
}
const remoteEventName = 'REMOTE_EVENT'

prestart(() => {
    if (!PHYSICSNET) return
    let eventCallIdCounter = 0
    ig.EventCall.inject({
        init(event, ...args) {
            this.uniqueId = eventCallIdCounter++
            this.event = event
            this.parent(event, ...args)
        },
        update() {
            if (!isRemote(multi.server)) return this.parent()
            if (this.event.name == remoteEventName) return false
            return this.parent()
        },
    })
})

/* eventCallStart */
const eventCallCache: Record<EventCallId, ig.EventCall> = {}
const uniqueIdOffsest = 100000

declare global {
    interface MapStateOrderedEvents {
        eventCallStart: {
            type: 'eventCallStart'

            instPlayerNetid?: EntityNetid

            eventCallId: number
            runType: ig.EventRunType
            callEntityNetid?: EntityNetid
        }
    }
}

registerOrderedEvent('eventCallStart', {
    set({ instPlayerNetid, eventCallId, runType, callEntityNetid }) {
        const inst = getInstFromInstPlayerNetid(instPlayerNetid)
        runTask(inst, () => {
            const event = new ig.Event({ name: remoteEventName, steps: [] })
            const callEntity = callEntityNetid ? ig.game.entitiesByNetid[callEntityNetid] : undefined

            const eventCall = new ig.EventCall(event, {}, runType)
            eventCall.callEntity = callEntity
            eventCall.uniqueId = eventCallId + uniqueIdOffsest

            eventCallCache[eventCallId] = eventCall
        })
    },
})
prestart(() => {
    if (!PHYSICSNET) return

    ig.EventCall.inject({})
    ig.EventManager.inject({
        callEvent(event, runType, onStart, onEnd, input, callEntity, data) {
            const eventCall = this.parent(event, runType, onStart, onEnd, input, callEntity, data)
            if (!shouldCollectStateData()) return eventCall

            pushOrderedEvent({
                type: 'eventCallStart',

                instPlayerNetid: ig.client?.dummy?.netid,

                eventCallId: eventCall.uniqueId,
                runType,
                callEntityNetid: callEntity?.netid,
            })

            return eventCall
        },
    })
})

/* eventCallEnd */
declare global {
    interface MapStateOrderedEvents {
        eventCallEnd: {
            type: 'eventCallEnd'
            eventCallId: number
        }
    }
}

registerOrderedEvent('eventCallEnd', {
    set({ eventCallId }) {
        const eventCall = eventCallCache[eventCallId]
        if (!eventCall) return

        delete eventCallCache[eventCallId]

        const inst = instanceinator.instances[eventCall._instanceId]
        if (!inst) return

        runTask(inst, () => {
            eventCall.setDone()
        })
    },
})
prestart(() => {
    if (!PHYSICSNET) return

    ig.EventCall.inject({
        setDone() {
            this.parent()
            if (!shouldCollectStateData()) return

            pushOrderedEvent({ type: 'eventCallEnd', eventCallId: this.uniqueId })
        },
    })
})

/* eventStep */
declare global {
    interface MapStateOrderedEvents {
        eventStep: {
            type: 'eventStep'

            eventCallId: number
            stepSettings: SerializedStepSettings
            data: Record<string, unknown>
            input: ig.Event.Vars
        }
    }
}

registerOrderedEvent('eventStep', {
    set({ eventCallId, stepSettings, data }) {
        const eventCall = eventCallCache[eventCallId]
        if (!eventCall) return

        const inst = instanceinator.instances[eventCall._instanceId]
        if (!inst) return

        runTask(inst, () => {
            deserializeStepSettingsRecursive(data)

            const stepSettingsDeserialized = deserializeEventStepSettings(stepSettings)
            const step = ig.StepHelpers.constructSteps(
                [stepSettingsDeserialized],
                ig.EVENT_STEP,
                {}
            ) as ig.EventStepBase

            ig.vars.setupCallScope({})
            step.start(data, eventCall)
            step.run(data)
            ig.vars.setupCallScope(null)
        })
    },
})

if (PHYSICSNET) {
    addEventStepStartListener((eventCall, step) => {
        if (!shouldCollectStateData()) return

        if (!isStepClassIdInEventStepWhitelist(step.classId) || eventCall.ignoreEventStepsCollection) return

        pushOrderedEvent({
            type: 'eventStep',

            eventCallId: eventCall.uniqueId,
            stepSettings: serializeEventStepSettings(step.settings),
            data: serializeStepSettingsRecursive(eventCall.data ?? {}),
            input: eventCall.stack?.[0]?.vars ?? {},
        })
    })
}

/* eventManager */
interface EventManagerData {
    runningEventCalls?: EventCallId[]
    blockingEventCall?: EventCallId // -1 if null
}

declare global {
    interface StateUpdatePacket {
        eventManager?: PartialRecord<string, EventManagerData>
    }
    namespace ig {
        interface MapSharedVars {
            eventManagerPlayerMemory?: Record<string, StateMemory.MapHolder<StateKey>>
        }
    }
}

function isEqual(a: any, b: any) {
    if (a === b) return true
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, i) => v == b[i])
    }
    return false
}

function tryAddData(
    packet: StateUpdatePacket,
    player: StateKey | undefined,
    key: string,
    inst: InstanceinatorInstance
) {
    ig.mapShared.eventManagerPlayerMemory ??= {}
    const memoryObj = (ig.mapShared.eventManagerPlayerMemory[key] ??= {})
    const memory = StateMemory.getBy(memoryObj, player)

    const events = inst.ig.game.events
    const data: EventManagerData = {
        runningEventCalls: events.runningEventCalls.map(c => c.uniqueId),
        blockingEventCall: events.blockingEventCall?.uniqueId ?? -1,
    }

    const dataDiffed = memory.diffRecord(data, (a, b) => isEqual(a, b))
    if (!dataDiffed) return

    packet.eventManager ??= {}
    packet.eventManager[key] = dataDiffed
}

export const eventManagerMapStateHandler: MapStateHandler = {
    get(packet, player) {
        tryAddData(packet, player, 'map', ig.mapShared.ccmap.inst)
        if (player) tryAddData(packet, player, player.username, player.getClient().inst)
    },
    set(packet) {
        if (!packet.eventManager) return

        for (const key in packet.eventManager) {
            const data = packet.eventManager[key]
            if (!data) continue

            const inst = key == 'map' ? ig.mapShared.ccmap.inst : multi.server.clients.get(key)?.inst
            if (!inst) continue

            if (data.blockingEventCall !== undefined) {
                inst.ig.game.events.blockingEventCall =
                    data.blockingEventCall == -1 ? null : eventCallCache[data.blockingEventCall]
            }
            if (data.runningEventCalls !== undefined) {
                inst.ig.game.events.runningEventCalls = data.runningEventCalls
                    .map(id => eventCallCache[id])
                    .filter(Boolean)
            }
        }
    },
}

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
//
// declare global {
//     namespace ig {
//         interface EventCall {
//         }
//     }
// }
