import { registerNetEntity } from '../../misc/entity-netid'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { prestart } from '../../loading-stages'

declare global {
    namespace ig.ENTITY {
        interface RegenDestruct extends StateMemory.MapHolder<StateKey> {
            lastRegenCompleteFrame?: number
        }
    }
    interface EntityStates {
        'ig.ENTITY.RegenDestruct': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.RegenDestruct, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        regenTimer: memory.diff(this.regenTimer),
        regenComplete: memory.diff(this.lastRegenCompleteFrame == ig.system.frame - 1),
    }
}

function setEntityState(this: ig.ENTITY.RegenDestruct, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
    if (state.regenTimer) this.regenTimer = state.regenTimer
    if (state.regenComplete) this.regenComplete()
}

export function register() {
    ig.ENTITY.RegenDestruct.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.RegenDestruct.create = () => {
        throw new Error('ig.ENTITY.RegenDestruct.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.RegenDestruct })
}

prestart(() => {
    ig.ENTITY.RegenDestruct.inject({
        regenComplete() {
            this.lastRegenCompleteFrame = ig.system.frame
            return this.parent()
        },
    })
})
