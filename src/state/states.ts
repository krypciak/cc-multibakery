declare global {
    interface StateUpdatePacket {}
}

import './defs/entity'

declare global {
    namespace ig {
        var settingState: boolean | undefined
        var lastStatePacket: StateUpdatePacket | undefined
    }
}

export function getFullEntityState() {
    const packet: StateUpdatePacket = {}

    for (const { get } of handlers) get(packet)

    return packet
}

type Handler = {
    get: (packet: StateUpdatePacket) => void
    set: (packet: StateUpdatePacket) => void
}
const handlers: Handler[] = []
export function addStateHandler(handler: Handler) {
    handlers.push(handler)
}

export function applyEntityStates(packet: StateUpdatePacket, tick: number) {
    ig.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick

    for (const { set } of handlers) set(packet)

    ig.system.tick = backup
    ig.settingState = false
    ig.lastStatePacket = packet
}

// export function getDiffEntityState(entities: ig.Entity[]) {
//     return getFullEntityState(entities)
// }
