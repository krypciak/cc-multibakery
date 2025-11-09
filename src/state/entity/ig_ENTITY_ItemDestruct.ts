import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface ItemDestruct extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.ItemDestruct': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.ItemDestruct, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        dropped: memory.diff(this.dropped),
    }
}

function setState(this: ig.ENTITY.ItemDestruct, state: Return) {
    if (state.dropped !== undefined) {
        if (state.dropped) {
            this.setDropped()
        }
    }
}

prestart(() => {
    ig.ENTITY.ItemDestruct.inject({
        getState,
        setState,
    })
    ig.ENTITY.ItemDestruct.create = () => {
        throw new Error('ig.ENTITY.ItemDestruct.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.ItemDestruct, isStatic: true })
}, 2)
