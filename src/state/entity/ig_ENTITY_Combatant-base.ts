import { StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import type { COMBATANT_PARTY } from '../../net/binary/binary-types'
import { addCombatantParty } from '../../party/combatant-party-api'
import { isRemote } from '../../server/remote/remote-server-types'
import type { f32 } from 'ts-binarifier/src/type-aliases'
import { runTasks } from 'cc-instanceinator/src/inst-util'

declare global {
    namespace sc {
        interface CombatParams {
            forceReportLocked?: boolean
        }
    }
}

function getStatusEntries(combatant: ig.ENTITY.Combatant) {
    type Rec = Record<keyof typeof combatant.statusGui.statusEntries, number>
    if (!combatant.statusGui) return {} as Rec
    return Object.fromEntries(Object.entries(combatant.statusGui.statusEntries).map(([k, v]) => [k, v.value])) as Rec
}

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ENTITY.Combatant, memory: StateMemory) {
    return {
        ...scActorEntity.getEntityState.call(this, memory),

        firstState: memory.onlyOnce(true),
        party: memory.diff(this.party as COMBATANT_PARTY),
        hp: memory.diff(this.params?.currentHp),
        defeated: memory.diff(this.params?.defeated),
        locked: memory.diff(this.params?.isLocked()),
        baseParams: memory.diffRecord(this.params?.baseParams ?? ({} as sc.CombatParams.BaseParams)),
        spLevel: memory.diff(this.params?.maxSp),
        sp: memory.diff(this.params?.currentSp),

        combatantLabelText: memory.diff(this.combatantLabelInfo?.text),
        combatantLabelTimer: memory.diff(this.combatantLabelInfo?.time as f32),
        combatantLabelAlign: memory.diff(this.combatantLabelInfo?.align),
        combatantLabelOffY: memory.diff(this.combatantLabelInfo?.offY),

        statusGui: memory.diffRecord(getStatusEntries(this)),
    }
}

export function setEntityState(this: ig.ENTITY.Combatant, state: Return) {
    scActorEntity.setEntityState.call(this, state)

    if (state.party !== undefined) {
        addCombatantParty(`unknown_party ${state.party}`, state.party)
        if (this instanceof dummy.DummyPlayer) sc.combat.removeActiveCombatant(this)
        this.party = state.party
        if (this instanceof dummy.DummyPlayer) sc.combat.addActiveCombatant(this)
    }

    if (this.params) {
        if (state.defeated !== undefined) {
            this.params.defeated = state.defeated
        }
        if (state.locked !== undefined) {
            this.params.forceReportLocked = state.locked
        }
        if (state.hp !== undefined) {
            this.params.currentHp = state.hp

            if (!ig.shared.settingStateImmediately && !state.firstState)
                notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.HP_CHANGED)
        }

        if (state.baseParams !== undefined) {
            StateMemory.applyChangeRecord(
                this.params.baseParams,
                Object.fromEntries(Object.entries(state.baseParams).filter(([_, v]) => v)) as typeof state.baseParams
            )

            if (!ig.shared.settingStateImmediately && !state.firstState)
                notifyMapAndPlayerInsts(this.params, sc.COMBAT_PARAM_MSG.STATS_CHANGED)
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

    if (this.statusGui) {
        if (state.statusGui !== undefined) {
            for (const type of Object.keys(state.statusGui) as (keyof typeof state.statusGui)[]) {
                const v = state.statusGui[type]
                const obj = this.statusGui.statusEntries[type]
                const diff = v - obj.value
                if (v >= 1) {
                    this.statusGui.setStatusEntryStick(type, true)
                } else if (v == 0) {
                    this.statusGui.clearStatusEntry(type)
                    obj.value = 0
                } else {
                    if (diff > 0) this.statusGui.setStatusEntry(type, v)
                    else this.statusGui.updateStatusEntry(type, v)
                }
            }
        }
    }

    if (state.combatantLabelText !== undefined) {
        const text = state.combatantLabelText
        const time = state.combatantLabelTimer
        const align = state.combatantLabelAlign
        const offY = state.combatantLabelOffY
        this.combatantLabelInfo = { text, time, align, offY }
        if (!(this instanceof dummy.DummyPlayer)) {
            runTasks(ig.mapShared.ccmap.getClientInstances(true), () => {
                const box = new sc.SmallEntityBox(
                    this,
                    text,
                    time || 1,
                    align ? sc.SMALL_BOX_ALIGN[align] : undefined,
                    offY
                )
                ig.gui.addGuiElement(box)
            })
        }
    }
}

prestart(() => {
    sc.CombatParams.inject({
        setBaseParams(baseParams, noEffect) {
            if (!isRemote(multi.server)) return this.parent(baseParams, noEffect)
        },
        isLocked() {
            if (this.forceReportLocked !== undefined) return this.forceReportLocked
            else return this.parent()
        },
    })
})
