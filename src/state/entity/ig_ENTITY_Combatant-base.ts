import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import type { COMBATANT_PARTY } from '../../net/binary/binary-types'
import { addCombatantParty } from '../../party/combatant-party-api'
import { isRemote } from '../../server/remote/is-remote-server'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    return {
        ...scActorEntity.getEntityState.call(this, memory),

        party: memory.diff(this.party as COMBATANT_PARTY),
        hp: memory.diff(this.params?.currentHp),
        defeated: memory.diff(this.params?.defeated),
        baseParams: memory.diffRecord(this.params?.baseParams ?? ({} as sc.CombatParams.BaseParams)),
        spLevel: memory.diff(this.params?.maxSp),
        sp: memory.diff(this.params?.currentSp),
    }
}

export function setEntityState(this: ig.ENTITY.Combatant, state: Return) {
    scActorEntity.setEntityState.call(this, state)

    if (state.party !== undefined) {
        addCombatantParty(`unkonwn_party_${state.party}`, state.party)
        if (this instanceof dummy.DummyPlayer) sc.combat.removeActiveCombatant(this)
        this.party = state.party
        if (this instanceof dummy.DummyPlayer) sc.combat.addActiveCombatant(this)
    }

    if (this.params) {
        if (state.defeated !== undefined) {
            this.params.defeated = state.defeated
        }
        if (state.hp !== undefined) {
            this.params.currentHp = state.hp
            notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.HP_CHANGED)
        }

        if (state.baseParams !== undefined) {
            StateMemory.applyChangeRecord(
                this.params.baseParams,
                Object.fromEntries(Object.entries(state.baseParams).filter(([_, v]) => v)) as typeof state.baseParams
            )
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
            if (!isRemote(multi.server)) return this.parent(baseParams, noEffect)
        },
    })
})
