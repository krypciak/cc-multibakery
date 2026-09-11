import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace sc {
        interface CompressedShockEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.CompressedShockEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.CompressedShockEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.CompressedShockEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.CompressedShockEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.CompressedShockEntity.create = (netid, state: Return) => {
        const settings: sc.CompressedShockEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.CompressedShockEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.CompressedShockEntity, temporary: true })
}, 2)
