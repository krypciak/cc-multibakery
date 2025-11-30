import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface Destructible extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Destructible': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Destructible, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getState.call(this, memory),
    }
}

function setState(this: ig.ENTITY.Destructible, state: Return) {
    igAnimatedEntity.setState.call(this, state)
}

prestart(() => {
    ig.ENTITY.Destructible.inject({
        getState,
        setState,
    })
    ig.ENTITY.Destructible.create = () => {
        throw new Error('ig.ENTITY.Destructible.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Destructible, isStatic: true })
}, 2)
