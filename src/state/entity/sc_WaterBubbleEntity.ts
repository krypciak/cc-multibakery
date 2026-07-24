import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././states'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace sc {
        interface WaterBubbleEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.WaterBubbleEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.WaterBubbleEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.WaterBubbleEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.WaterBubbleEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.WaterBubbleEntity.create = (netid, state: Return) => {
        const settings: sc.WaterBubbleEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.WaterBubbleEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.WaterBubbleEntity })
}, 2)
