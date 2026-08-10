import type { Client } from '../client/client'

declare global {
    interface StateUpdatePacket {}
}

export type StateKey = Client

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

import { clearEffectsMapStateHandler, stopEffectsMapStateHandler } from './entity/ig_ENTITY_Effect'
import { entityDeathMapStateHandler } from './entity/entity-death'
import { destroyCombatProxiesMapStateHandler } from './entity/sc_CombatProxyEntity'
import { entityCreateMapStateHandler, entityStateMapStateHandler } from './entity'
import { entityHitMapStateHandler } from './entity/entity-hit-effect'
import { eventStepsMapStateHandler } from './event-steps'
import { gameModelStateMapStateHandler } from './game-model-state'
import { pvpMapStateHandler } from './pvp'
import { hitNumberClearMapStateHandler, hitNumberSpawnMapStateHandler } from './hit-number'
import { varsMapStateHandler } from './vars'

const mapStateHandlers: MapStateHandler[] = [
    clearEffectsMapStateHandler,
    stopEffectsMapStateHandler,
    destroyCombatProxiesMapStateHandler,
    entityDeathMapStateHandler,
    entityCreateMapStateHandler,
    entityStateMapStateHandler,
    entityHitMapStateHandler,
    eventStepsMapStateHandler,
    gameModelStateMapStateHandler,
    pvpMapStateHandler,
    hitNumberSpawnMapStateHandler,
    hitNumberClearMapStateHandler,
    varsMapStateHandler,
]

if (TEST) {
    await import('../test/test-setup-mod-side').then(o => mapStateHandlers.push(o.testMapStateHandler))
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
