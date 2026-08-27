import { shouldCollectStateData, StateMemory } from '../state-util'
import * as scActorEntity from './sc_ActorEntity-base'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import type { COMBATANT_PARTY } from '../../net/binary/binary-types'
import { addCombatantParty } from '../../party/combatant-party-api'
import { isRemote } from '../../server/remote/remote-server-types'
import type { f32, u16, u4 } from 'ts-binarifier/src/type-aliases'
import { runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import type { StateKey } from '../map-state-handlers'
import type { EntityNetid } from '../../misc/entity-netid'

declare global {
    namespace sc {
        interface CombatParams {
            forceReportLocked?: boolean
        }
    }
}

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ENTITY.Combatant, player: StateKey | undefined, memory: StateMemory) {
    return {
        ...scActorEntity.getEntityState.call(this, player, memory),

        firstState: memory.onlyOnce(true),
        party: memory.diff(this.party as COMBATANT_PARTY),
        hp: memory.diff(this.params?.currentHp),
        defeated: memory.diff(this.params?.defeated),
        locked: memory.diff(this.params?.isLocked()),
        baseParams: memory.diffRecord(this.params?.baseParams ?? ({} as sc.CombatParams.BaseParams)),
        spLevel: memory.diff(this.params?.maxSp),
        sp: memory.diff(this.params?.currentSp),

        buffsRemoved: memory.diffRecord(this.params?.buffsRemoved ?? {}),
        buffs: memory.diffRecord2Deep(getBuffs(this)),
        currentItemBuffs: memory.diff(this.params?.currentItemBuffs),

        combatantLabelText: memory.diff(this.combatantLabelInfo?.text),
        combatantLabelTimer: memory.diff(this.combatantLabelInfo?.time as f32),
        combatantLabelAlign: memory.diff(this.combatantLabelInfo?.align),
        combatantLabelOffY: memory.diff(this.combatantLabelInfo?.offY),

        statusGui: memory.diffRecord(getStatusEntries(this)),

        target: memory.diff(this.target?.netid ?? (0 as EntityNetid)),
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
        if (isRemote(multi.server)) {
            if (state.defeated !== undefined) {
                this.params.defeated = state.defeated
            }
            if (state.locked !== undefined) {
                this.params.forceReportLocked = state.locked
            }
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

        setBuffs(this, state)
    }

    if (this.statusGui && state.statusGui !== undefined) setStatusEntries(this, state.statusGui)

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

    if (state.target !== undefined) {
        if (state.target === 0) {
            this.setTarget(null)
        } else {
            const entity = ig.game.entitiesByNetid[state.target]
            if (!entity) {
                // console.warn('ig.ENTITY.Combatant target not found:', state.target)
            } else {
                assert(entity instanceof ig.ENTITY.Combatant)
                this.setTarget(entity)
            }
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

function getStatusEntries(combatant: ig.ENTITY.Combatant) {
    type Rec = Record<keyof typeof combatant.statusGui.statusEntries, number>
    if (!combatant.statusGui) return {} as Rec
    return Object.fromEntries(Object.entries(combatant.statusGui.statusEntries).map(([k, v]) => [k, v.value])) as Rec
}
function setStatusEntries(combatant: ig.ENTITY.Combatant, statusGui: ReturnType<typeof getStatusEntries>) {
    for (const type of Object.keys(statusGui) as (keyof typeof statusGui)[]) {
        const v = statusGui[type]
        const obj = combatant.statusGui.statusEntries[type]
        const diff = v - obj.value
        if (v >= 1) {
            combatant.statusGui.setStatusEntryStick(type, true)
        } else if (v == 0) {
            combatant.statusGui.clearStatusEntry(type)
            obj.value = 0
        } else {
            if (diff > 0) combatant.statusGui.setStatusEntry(type, v)
            else combatant.statusGui.updateStatusEntry(type, v)
        }
    }
}

declare global {
    namespace sc {
        interface StatChange {
            statNames: sc.StatChange.StatName[]
        }
    }
}
prestart(() => {
    sc.StatChange.inject({
        init(stats, ...args) {
            this.statNames = stats
            this.parent(stats, ...args)
        },
    })
})

declare global {
    namespace sc {
        interface CombatParams {
            buffsRemoved?: Record<u4, u16>
        }
    }
}

prestart(() => {
    sc.CombatParams.inject({
        removeBuff(buff) {
            if (shouldCollectStateData()) {
                const i = this.buffs.indexOf(buff)
                const rec = (this.buffsRemoved ??= {})
                rec[i] ??= 0
                rec[i]++
            }
            return this.parent(buff)
        },
    })
})

function getBuffs(combatant: ig.ENTITY.Combatant) {
    return Object.fromEntries(
        (combatant.params?.buffs ?? []).map((buff, i) => [
            i,
            {
                statNames: buff.statNames as string[] | undefined,

                itemID: buff instanceof sc.ItemBuff ? buff.itemID : undefined,
                time: buff instanceof sc.ItemBuff ? buff.time : undefined,
                timer: buff instanceof sc.ItemBuff ? buff.timer : undefined,

                active: buff instanceof sc.ActionBuff ? buff.active : undefined,
                name: buff instanceof sc.ActionBuff ? buff.name : undefined,
                hacked: buff instanceof sc.ActionBuff ? buff.hacked : undefined,
            },
        ])
    )
}

function createBuff(data: NonNullable<NonNullable<Return['buffs']>[string]>) {
    assert(data.statNames)
    if (data.time !== undefined) {
        assert(data.itemID !== undefined)
        return new sc.ItemBuff(data.statNames, data.time, data.itemID)
    } else {
        assert(data.name !== undefined)
        assert(data.hacked !== undefined)
        return new sc.ActionBuff(data.statNames, data.name, data.hacked)
    }
}

function setBuffs(combatant: ig.ENTITY.Combatant, state: Return) {
    const p = combatant.params!
    const cbuffs = p.buffs

    if (state.currentItemBuffs !== undefined) p.currentItemBuffs = state.currentItemBuffs

    if (state.buffsRemoved !== undefined) {
        const indexes = Object.keys(state.buffsRemoved)
            .map(Number)
            .sort((a, b) => b - a)
        for (const i of indexes) {
            const cbuff = cbuffs[i]
            if (!cbuff) continue
            cbuff.clear()
            cbuffs.splice(i, 1)
            sc.Model.notifyObserver(p, sc.COMBAT_PARAM_MSG.BUFF_REMOVED, cbuff)
            sc.Model.notifyObserver(p, sc.COMBAT_PARAM_MSG.STATS_CHANGED)
        }
        runTasks(ig.mapShared.ccmap.getClientInstances(true), () => {
            const buffGui = sc.gui.statusHud?.lowerGui?.buffGui
            buffGui?.update()
        })
    }

    const buffs = state.buffs
    if (buffs !== undefined) {
        const indexes = Object.keys(buffs)
            .map(Number)
            .sort((a, b) => b - a)
        for (const i of indexes) {
            const data = buffs[i]
            let cbuff = cbuffs[i]
            if (!data) {
                assert(!cbuff, 'buffsRemoved didnt remove buff properly!')
            } else {
                if (cbuff) {
                    if (data.statNames !== undefined) {
                        if (cbuff instanceof sc.ActionBuff) {
                            data.name ??= cbuff.name
                            data.hacked ??= cbuff.hacked
                            data.active ??= cbuff.active
                        } else if (cbuff instanceof sc.ItemBuff) {
                            data.itemID ??= cbuff.itemID
                            data.time ??= cbuff.time
                            data.timer ??= cbuff.timer
                        }
                        assert(
                            cbuff.statNames.length == data.statNames.length &&
                                cbuff.statNames.every((v, i) => v == data.statNames![i])
                        )
                    }
                    if (data.timer != undefined) (cbuff as sc.ItemBuff).timer = data.timer
                    if (data.active !== undefined) (cbuff as sc.ActionBuff).active = data.active
                } else {
                    cbuff = createBuff(data)
                    assert(p.buffs.length == i)
                    p.buffs[i] = cbuff
                    sc.Model.notifyObserver(p, sc.COMBAT_PARAM_MSG.BUFF_ADDED, cbuff)
                    sc.Model.notifyObserver(p, sc.COMBAT_PARAM_MSG.STATS_CHANGED)
                }
            }
        }
    }
}
