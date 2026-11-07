import { registerNetEntity } from '../../misc/entity-netid'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { prestart } from '../../loading-stages'

declare global {
    namespace ig.ENTITY {
        interface WaterBubblePanel extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WaterBubblePanel': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.WaterBubblePanel, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.WaterBubblePanel, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.WaterBubblePanel.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.WaterBubblePanel.create = () => {
        throw new Error('ig.ENTITY.WaterBubblePanel.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.WaterBubblePanel })
}

prestart(() => {
    ig.ENTITY.WaterBubblePanel.inject({
        spawnBubble(noEffects) {
            if (!multi.server) return this.parent(noEffects)
            if (this.currentBubble) return
            this.parent(noEffects)
        },
    })
})
