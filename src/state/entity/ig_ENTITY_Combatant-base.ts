import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/ccmap'

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    return {
        ...scActorEntity.getState.call(this, memory),

        hp: memory.diff(this.params?.currentHp),
        baseParams: memory.diffRecord(this.params?.baseParams ?? {}),
    }
}

export function setState(this: ig.ENTITY.Combatant, state: Return) {
    scActorEntity.setState.call(this, state)

    if (this.params) {
        if (state.hp !== undefined) {
            this.params.currentHp = state.hp
            notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.HP_CHANGED)
        }

        if (state.baseParams !== undefined) {
            StateMemory.applyChangeRecord(this.params.baseParams, state.baseParams)
            notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.STATS_CHANGED, ig.settingStateImmediately)
        }
    }
}

prestart(() => {
    sc.CombatParams.inject({
        setBaseParams(baseParams, noEffect) {
            if (!(multi.server instanceof RemoteServer)) this.parent(baseParams, noEffect)
        },
    })
})
