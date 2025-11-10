import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import { WallBaseReturn } from './ig_ENTITY_WallBase-base'
import './ig_ENTITY_WallBase-base'

declare global {
    namespace ig.ENTITY {
        interface WallVertical extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WallVertical': WallBaseReturn
    }
}

prestart(() => {
    registerNetEntity({ entityClass: ig.ENTITY.WallVertical, isStatic: true })
}, 2)
