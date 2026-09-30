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

interface Handler<T> {
    set(data: Extract<EventUnion, { type: T }>, packet?: StateUpdatePacket): void
}

const eventMap: {
    [T in EventUnion['type']]: Handler<T>
} = {} as any

export function registerOrderedEvent<T extends EventUnion['type']>(type: T, handler: Handler<T>) {
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
            handler.set(event as any, packet)
        }
    },
}
