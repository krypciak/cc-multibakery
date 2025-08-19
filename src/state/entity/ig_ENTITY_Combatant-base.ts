import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    return {
        ...scActorEntity.getState.call(this, memory),
    }
}

export function setState(this: ig.ENTITY.Combatant, state: Return) {
    scActorEntity.setState.call(this, state)
}
