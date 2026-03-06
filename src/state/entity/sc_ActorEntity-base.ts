import type { StateMemory } from '../state-util'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: sc.ActorEntity, memory: StateMemory) {
    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        face: memory.diffVec2(this.face),
    }
}

export function setEntityState(this: sc.ActorEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.face) this.face = state.face
}
