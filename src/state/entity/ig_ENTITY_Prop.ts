import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface Prop extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Prop': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Prop, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {}
}
function setState(this: ig.ENTITY.Prop, state: Return) {}

prestart(() => {
    ig.ENTITY.Prop.inject({
        getState,
        setState,
    })
    ig.ENTITY.Prop.create = () => {
        throw new Error('ig.ENTITY.Prop.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Prop, isStatic: true })
}, 2)
