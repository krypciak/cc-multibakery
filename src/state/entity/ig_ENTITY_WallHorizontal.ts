import { registerNetEntity } from '../../misc/entity-netid'
import type { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import type { WallBaseReturn } from './ig_ENTITY_WallBase-base'
import './ig_ENTITY_WallBase-base'

declare global {
    namespace ig.ENTITY {
        interface WallHorizontal extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WallHorizontal': WallBaseReturn
    }
}

export function register() {
    registerNetEntity({ entityClass: ig.ENTITY.WallHorizontal })
}
