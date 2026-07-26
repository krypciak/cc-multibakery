import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface SlidingBlock extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.SlidingBlock': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.SlidingBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.SlidingBlock, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.SlidingBlock.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.SlidingBlock.create = () => {
        throw new Error('ig.ENTITY.SlidingBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.SlidingBlock, isStatic: true })
}, 2)
