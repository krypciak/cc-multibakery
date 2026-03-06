import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././states'
import { assert } from '../../misc/assert'

declare global {
    namespace sc {
        interface FoodIconEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.FoodIconEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.FoodIconEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.diffVec3(this.coll.pos),
        combatant: memory.onlyOnce(this.combatant.netid),
        icon: memory.onlyOnce(this.icon),
        state: memory.diff(this.state),
        offset: memory.diffVec2(this.offset)
    }
}

function setEntityState(this: sc.FoodIconEntity, state: Return) {
    if (state.pos) this.setPos(state.pos.x, state.pos.y, state.pos.z)

    if (state.state !== undefined) this.setState(state.state, this.offset)
    if (state.offset !== undefined) this.setState(this.state, state.offset)
}

prestart(() => {
    sc.FoodIconEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.FoodIconEntity.create = (netid, state: Return) => {
        assert(state.combatant)
        const combatant = ig.game.entitiesByNetid[state.combatant]
        if (!combatant) console.warn('sc.FoodIconEntity#create combatant not found:', state.combatant)
        assert(combatant instanceof ig.ENTITY.Combatant)

        assert(state.icon !== undefined)

        const settings: sc.FoodIconEntity.Settings = {
            netid,
            combatant,
            icon: state.icon,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.FoodIconEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.FoodIconEntity, ignoreDeath: true })

    sc.FoodIconEntity.forceRemotePhysics = true
}, 2)
