import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface ItemDestruct extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.ItemDestruct': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.ItemDestruct, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        dropped: memory.diff(this.dropped),
    }
}

function setEntityState(this: ig.ENTITY.ItemDestruct, state: Return) {
    if (state.dropped !== undefined) {
        if (state.dropped) {
            this.setDropped()
        }
    }
}

prestart(() => {
    ig.ENTITY.ItemDestruct.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.ItemDestruct.create = () => {
        throw new Error('ig.ENTITY.ItemDestruct.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.ItemDestruct, isStatic: true })
}, 2)
