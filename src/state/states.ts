import { globalStateHandlers } from './global-state-handlers'
import type { GlobalStateKey } from './global-state-handlers'
import { mapStateHandlers } from './map-state-handlers'
import type { StateKey } from './map-state-handlers'

declare global {
    interface StateUpdatePacket {}
    interface GlobalStateUpdatePacket {}
}

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

export function getEntityStateUpdatePacket(dest: StateUpdatePacket = {}, client?: StateKey, cache?: StateUpdatePacket) {
    for (const { get } of mapStateHandlers) get(dest, client, cache)

    return dest
}

export function getGlobalStateUpdatePacket(
    dest: GlobalStateUpdatePacket = {},
    conn: GlobalStateKey,
    cache?: GlobalStateUpdatePacket
) {
    for (const { get } of globalStateHandlers) get(dest, conn, cache)

    return dest
}

export function clearCollectedState() {
    for (const { clear } of mapStateHandlers) clear?.()
    for (const { clear } of globalStateHandlers) clear?.()
}

export function applyStateUpdatePacket(packet: StateUpdatePacket, tick: number, immediately: boolean) {
    ig.shared.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick
    ig.shared.settingStateImmediately = immediately

    for (const { set } of mapStateHandlers) set(packet)

    ig.system.tick = backup
    ig.shared.settingState = false
    ig.shared.settingStateImmediately = false
    ig.mapShared.lastStatePacket = packet
}

export function applyGlobalStateUpdatePacket(packet: GlobalStateUpdatePacket) {
    ig.shared.settingState = true

    for (const { set } of globalStateHandlers) set(packet)

    ig.shared.settingState = false
}
