import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace sc {
        interface FerroEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.FerroEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.FerroEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.FerroEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.FerroEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.FerroEntity.create = (netid, state: Return) => {
        const settings: sc.FerroEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.FerroEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.FerroEntity })
}, 2)
