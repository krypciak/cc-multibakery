import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace sc {
        interface BombEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.BombEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.BombEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.BombEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.BombEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.BombEntity.create = (netid, state: Return) => {
        const settings: sc.BombEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.BombEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.BombEntity })
}, 2)
