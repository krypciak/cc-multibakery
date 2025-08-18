import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { createNetidStatic } from './entity'
import { StateMemory } from './state-util'
import { StateKey } from './states'

declare global {
    namespace ig.ENTITY {
        interface NPC extends StateMemory.MapHolder<StateKey> {}
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.NPC, _player?: StateKey) {
    // const memory = StateMemory.getBy(this, player)
    return {}
}

function setState(this: ig.ENTITY.NPC, _state: Return) {}

prestart(() => {
    const typeId: EntityTypeId = 'np'
    ig.ENTITY.NPC.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.NPC.create = () => {
        throw new Error('ig.ENTITY.NPC.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.NPC, typeId })
}, 2)
