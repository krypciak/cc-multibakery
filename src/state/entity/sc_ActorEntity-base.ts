import { StateMemory } from '../state-util'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

type Return = ReturnType<typeof getState>
export function getState(this: sc.ActorEntity, memory: StateMemory) {
    return {
        ...igAnimatedEntity.getState.call(this, memory),

        face: memory.diffVec2(this.face),
    }
}

export function setState(this: sc.ActorEntity, state: Return) {
    igAnimatedEntity.setState.call(this, state)

    if (state.face) this.face = state.face
}
