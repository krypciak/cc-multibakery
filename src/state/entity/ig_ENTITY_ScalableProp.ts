import { registerNetEntity } from '../../misc/entity-netid'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'

declare global {
    namespace ig.ENTITY {
        interface ScalableProp extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.ScalableProp': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.ScalableProp, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {}
}
function setEntityState(this: ig.ENTITY.ScalableProp, state: Return) {}

export function register() {
    ig.ENTITY.ScalableProp.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.ScalableProp.create = () => {
        throw new Error('ig.ENTITY.ScalableProp.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.ScalableProp })
}
