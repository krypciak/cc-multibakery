import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { type f64 } from 'ts-binarifier/src/type-aliases'
import {
    type AttackType,
    type COMBATANT_PARTY,
    type DefenceType,
    type FocusType,
    type HpType,
    type SpLevelType,
    type SpType,
} from '../../net/binary/binary-types'
import { addCombatantParty } from '../../party/combatant-party-api'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace sc {
        namespace CombatParams {
            interface Params {
                hp: HpType
                attack: AttackType
                defense: DefenceType
                focus: FocusType

                elemFactor?: f64[]
                statusInflict?: f64[]
                statusEffect?: f64[]
            }
        }
        interface CombatParams {
            currentHp: HpType
            maxSp: SpLevelType
            currentSp: SpType
        }
    }
    namespace ig.ENTITY {
        interface Combatant {
            // party: COMBATANT_PARTY
        }
    }
}

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    return {
        ...scActorEntity.getState.call(this, memory),

        party: memory.diff(this.party as COMBATANT_PARTY),
        hp: memory.diff(this.params?.currentHp),
        baseParams: memory.diffRecord(this.params?.baseParams ?? ({} as sc.CombatParams.BaseParams)),
        spLevel: memory.diff(this.params?.maxSp),
        sp: memory.diff(this.params?.currentSp),
    }
}

export function setState(this: ig.ENTITY.Combatant, state: Return) {
    scActorEntity.setState.call(this, state)

    if (state.party !== undefined) {
        this.party = state.party
        addCombatantParty(`unkonwn_party_${state.party}`, this.party)
    }

    if (this.params) {
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
