import type { StateKey } from '../map-state-handlers'
import { StateMemory } from '../state-util'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ActorEntity, _player: StateKey | undefined, memory: StateMemory) {
    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        animationFixed: memory.diff(this.animationFixed),

        hasCurrentAction: memory.diff(!!this.currentAction),
    }
}

export function setEntityState(this: ig.ActorEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.animationFixed !== undefined) this.animationFixed = state.animationFixed

    if (state.hasCurrentAction === false) {
        this.currentAction = null
        this.currentActionStep = null
    }
}
