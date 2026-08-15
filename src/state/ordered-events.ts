import type { MapStateHandler } from './map-state-handlers'

type EventUnion = {
    [T in keyof MapStateOrderedEvents]: MapStateOrderedEvents[T]
}[keyof MapStateOrderedEvents]

declare global {
    interface StateUpdatePacket {
        orderedEvents?: EventUnion[]
    }

    interface MapStateOrderedEvents {}

    namespace ig {
        interface MapSharedVars {
            orderedEvents?: EventUnion[]
        }
    }
}

export function pushOrderedEvent(event: EventUnion) {
    ig.mapShared.orderedEvents ??= []
    ig.mapShared.orderedEvents.push(event)
}

const eventMap: {
    [T in EventUnion['type']]: {
        set(data: Extract<EventUnion, { type: T }>): void
    }
} = {} as any

export function registerOrderedEvent<T extends EventUnion['type']>(
    type: T,
    handler: {
        set(data: Extract<EventUnion, { type: T }>): void
    }
) {
    eventMap[type] = handler as (typeof eventMap)[T]
}

export const orderedEventsMapStateHandler: MapStateHandler = {
    get(packet) {
        packet.orderedEvents = ig.mapShared.orderedEvents
    },
    clear() {
        ig.mapShared.orderedEvents = undefined
    },
    set(packet) {
        if (!packet.orderedEvents) return
        for (const event of packet.orderedEvents) {
            const handler = eventMap[event.type]
            handler.set(event as any)
        }
    },
}
