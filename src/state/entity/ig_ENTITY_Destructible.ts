import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
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
    const typeId: EntityTypeId = 'de'
    ig.ENTITY.Destructible.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Destructible.create = () => {
        throw new Error('ig.ENTITY.Destructible.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Destructible, typeId, netidStatic: true })
}, 2)
