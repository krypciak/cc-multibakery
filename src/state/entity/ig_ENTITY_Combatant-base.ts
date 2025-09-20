import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { f32, f64, u14, u6 } from 'ts-binarifier/src/type-aliases'

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    const sp = this.params?.currentSp
    return {
        ...scActorEntity.getState.call(this, memory),

        hp: memory.diff(this.params?.currentHp),
        baseParams: memory.diffRecord(
            (this.params?.baseParams ?? {}) as {
                hp: u14
                attack: u14
                defense: u14
                focus: u14

                elemFactor?: f64[]
                statusInflict?: f64[]
                statusEffect?: f64[]
            }
        ),
        spLevel: memory.diff(this.params?.maxSp as u6),
        sp: memory.diff(sp === undefined ? undefined : (sp as f32)),
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

        if (state.spLevel !== undefined) {
            this.params.maxSp = state.spLevel
            notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.MAX_SP_CHANGED)
        }
        if (state.sp !== undefined) {
            this.params.currentSp = state.sp
            notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.SP_CHANGED)
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
