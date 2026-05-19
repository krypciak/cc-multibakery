import type { Client } from '../client/client'
import type { NetConnection } from '../net/connection'

declare global {
    interface StateUpdatePacket {}
    interface GlobalStateUpdatePacket {}
}

export type StateKey = Client
export type GlobalStateKey = NetConnection

// local
import './entity'
import './event-steps'
import './game-model-state'
import './pvp'
import './hit-number'

// global & local
import './vars'

// global
import './areas'
import './player-info'
import './party'

declare global {
    namespace ig {
        interface InstanceShared {
            settingState?: boolean
            settingStateImmediately?: boolean
        }
        interface MapSharedVars {
            lastStatePacket?: StateUpdatePacket
        }
    }
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

interface GlobalHandler {
    get: (packet: GlobalStateUpdatePacket, conn: GlobalStateKey, cache?: GlobalStateUpdatePacket) => void
    clear?: () => void
    set: (packet: GlobalStateUpdatePacket) => void
}
const globalHandlers: GlobalHandler[] = []
export function addGlobalStateHandler(handler: GlobalHandler) {
    globalHandlers.push(handler)
}

export function getEntityStateUpdatePacket(dest: StateUpdatePacket = {}, client?: StateKey, cache?: StateUpdatePacket) {
    for (const { get } of handlers) get(dest, client, cache)

    return dest
}

export function getGlobalStateUpdatePacket(
    dest: GlobalStateUpdatePacket = {},
    conn: GlobalStateKey,
    cache?: GlobalStateUpdatePacket
) {
    for (const { get } of globalHandlers) get(dest, conn, cache)

    return dest
}

export function clearCollectedState() {
    for (const { clear } of handlers) clear?.()
    for (const { clear } of globalHandlers) clear?.()
}

export function applyStateUpdatePacket(packet: StateUpdatePacket, tick: number, immediately: boolean) {
    ig.shared.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick
    ig.shared.settingStateImmediately = immediately

    for (const { set } of handlers) set(packet)

    ig.system.tick = backup
    ig.shared.settingState = false
    ig.shared.settingStateImmediately = false
    ig.mapShared.lastStatePacket = packet
}

export function applyGlobalStateUpdatePacket(packet: GlobalStateUpdatePacket) {
    ig.shared.settingState = true

    for (const { set } of globalHandlers) set(packet)

    ig.shared.settingState = false
}
