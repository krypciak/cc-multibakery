import type { StateKey } from './states'

export interface MapStateHandler {
    get: (packet: StateUpdatePacket, client?: StateKey, cache?: StateUpdatePacket) => void
    clear?: () => void
    set: (packet: StateUpdatePacket) => void
}

import { clearEffectsMapStateHandler, stopEffectsMapStateHandler } from './entity/ig_ENTITY_Effect'
import { entityDeathMapStateHandler } from './entity/entity-death'
import { destroyCombatProxiesMapStateHandler } from './entity/sc_CombatProxyEntity'
import { entityStateMapStateHandler } from './entity'
import { entityHitMapStateHandler } from './entity/entity-hit-effect'
import { eventStepsMapStateHandler } from './event-steps'
import { gameModelStateMapStateHandler } from './game-model-state'
import { pvpMapStateHandler } from './pvp'
import { hitNumberClearMapStateHandler, hitNumberSpawnMapStateHandler } from './hit-number'
import { varsMapStateHandler } from './vars'
import { actionStepsMapStateHandler, clearActionAttachedStateHandler } from './action-steps'

export const mapStateHandlers: MapStateHandler[] = [
    clearEffectsMapStateHandler,
    stopEffectsMapStateHandler,
    destroyCombatProxiesMapStateHandler,
    entityDeathMapStateHandler,
    entityStateMapStateHandler,
    entityHitMapStateHandler,
    eventStepsMapStateHandler,
    gameModelStateMapStateHandler,
    pvpMapStateHandler,
    hitNumberSpawnMapStateHandler,
    hitNumberClearMapStateHandler,
    varsMapStateHandler,
    clearActionAttachedStateHandler,
    actionStepsMapStateHandler,
]

if (TEST) {
    await import('../test/test-setup-mod-side').then(o => mapStateHandlers.push(o.testMapStateHandler))
}
