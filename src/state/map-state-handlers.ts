declare global {
    interface StateUpdatePacket {}
}

export type StateKey = dummy.DummyPlayer

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

export interface MapStateHandler {
    get: (packet: StateUpdatePacket, client?: StateKey, cache?: StateUpdatePacket) => void
    clear?: () => void
    set: (packet: StateUpdatePacket) => void
}

import { orderedEventsMapStateHandler } from './ordered-events'
import { entityStateMapStateHandler } from './entity/entity-state'
import { entityDeathMapStateHandler } from './entity/entity-death'
import { gameModelStateMapStateHandler } from './game-model-state'
import { pvpMapStateHandler } from './pvp'
import { varsMapStateHandler } from './vars'
import { eventManagerMapStateHandler } from './event-steps'

const mapStateHandlers: MapStateHandler[] = [
    orderedEventsMapStateHandler,
    entityStateMapStateHandler,
    entityDeathMapStateHandler,
    gameModelStateMapStateHandler,
    pvpMapStateHandler,
    varsMapStateHandler,
    eventManagerMapStateHandler,
]

if (TEST) {
    import('../test/test-setup-mod-side').then(o => mapStateHandlers.push(o.testMapStateHandler))
}

export function getMapStateUpdatePacket(dest: StateUpdatePacket = {}, client?: StateKey, cache?: StateUpdatePacket) {
    for (const { get } of mapStateHandlers) get(dest, client, cache)

    return dest
}

export function applyMapStateUpdatePacket(packet: StateUpdatePacket, tick: number, immediately: boolean) {
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

export function clearCollectedMapState() {
    for (const { clear } of mapStateHandlers) clear?.()
}
