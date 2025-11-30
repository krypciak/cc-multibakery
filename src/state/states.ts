import type { Client } from '../client/client'

declare global {
    interface StateUpdatePacket {}
}

export type StateKey = Client

import './entity'
import './vars'
import './event-steps'
import './game-model-state'
import './pvp'
import './hit-number'
import './player-location'
import './areas'

declare global {
    namespace ig {
        var settingState: boolean | undefined
        var settingStateImmediately: boolean | undefined
        var lastStatePacket: StateUpdatePacket | undefined
    }
}

export function getStateUpdatePacket(dest: StateUpdatePacket = {}, client?: StateKey, cache?: StateUpdatePacket) {
    for (const { get } of handlers) get(dest, client, cache)

    return dest
}

export function clearCollectedState() {
    for (const { clear } of handlers) clear?.()
}

interface Handler {
    get: (packet: StateUpdatePacket, client?: StateKey, cache?: StateUpdatePacket) => void
    clear?: () => void
    set: (packet: StateUpdatePacket) => void
}
const handlers: Handler[] = []
export function addStateHandler(handler: Handler) {
    handlers.push(handler)
}

export function applyStateUpdatePacket(packet: StateUpdatePacket, tick: number, immediately: boolean) {
    ig.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick
    ig.settingStateImmediately = immediately

    for (const { set } of handlers) set(packet)

    ig.system.tick = backup
    ig.settingState = false
    ig.settingStateImmediately = false
    ig.lastStatePacket = packet
}
