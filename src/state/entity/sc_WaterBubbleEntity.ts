import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { assert } from '../../misc/assert'

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
        panel: memory.onlyOnce(this.panel?.netid),
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
        const panel = state.panel ? ig.game.entitiesByNetid[state.panel] : undefined
        if (panel) assert(panel instanceof ig.ENTITY.WaterBubblePanel)
        if (panel?.currentBubble) panel.currentBubble.kill(true)

        const settings: sc.WaterBubbleEntity.Settings = { panel, netid }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.WaterBubbleEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.WaterBubbleEntity, temporary: true })
}, 2)
