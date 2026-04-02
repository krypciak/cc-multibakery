import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as scPlayerBaseEntity from './sc_PlayerBaseEntity-base'
import type { RecordSize, u10, u11, u3 } from 'ts-binarifier/src/type-aliases'
import type { ItemType } from '../../net/binary/binary-types'

declare global {
    namespace ig.ENTITY {
        interface Player extends StateMemory.MapHolder<StateKey> {}
    }
}

function getSkills(this: ig.ENTITY.Player): boolean[] {
    const skillCount = this.model.skills.length
    const skills = new Array(skillCount)
    for (let i = 0; i < skillCount; i++) {
        skills[i] = this.model.skills[i] ? true : false
    }
    return skills
}

function setSkills(this: ig.ENTITY.Player, skills: Record<number, boolean>) {
    for (const idStr in skills) {
        const id = parseInt(idStr)
        this.model.skills[id] = skills[id] ? sc.skilltree.skills[id] : null
    }
}

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ENTITY.Player, player?: StateKey, memory?: StateMemory) {
    const chargeLevel = this.charging.time == -1 ? 0 : this.getCurrentChargeLevel() || 1

    memory ??= StateMemory.getBy(this, player)

    const items = !player || this == player.dummy ? memory.onlyOnce(this.model.items as (ItemType | null)[]) : undefined
    const itemsDiff =
        !player || this == player.dummy
            ? memory.diffRecord(this.model.items as Record<ItemType, u10 | null> & RecordSize<u11>)
            : undefined

    return {
        ...scPlayerBaseEntity.getEntityState.call(this, memory),

        interactObject: memory.diff(this.interactObject?.entity?.netid),

        items,
        itemsDiff: items ? undefined : itemsDiff,
        charge: memory.diff(chargeLevel as u3),
        credit: memory.diff(this.model.credit),
        skillPoints: !player || this == player.dummy ? memory.diffArray(this.model.skillPoints) : undefined,
        skills: !player || this == player.dummy ? memory.diffArray(getSkills.call(this)) : undefined,
        elementLoad: memory.diff(this.model.elementLoad),
        hasOverload: memory.diff(this.model.hasOverload),
    }
}

export function setEntityState(this: ig.ENTITY.Player, state: Return) {
    if (state.modelName !== undefined) {
        let config: sc.PlayerConfig
        if (this instanceof dummy.DummyPlayer && this.getClient(true)) {
            const client = this.getClient()
            config = client.inst.sc.party.models[state.modelName!].config
        } else config = sc.party.models[state.modelName].config
        this.model.setConfig(config)
    }

    let updateStats: boolean = false
    if (state.skillPoints) StateMemory.applyChangeRecord(this.model.skillPoints, state.skillPoints)
    if (state.skills) {
        setSkills.call(this, state.skills)
        updateStats = true
    }

    scPlayerBaseEntity.setEntityState.call(this, state, updateStats)

    if (state.interactObject) {
        const entity = ig.game.entitiesByNetid[state.interactObject]
        assert('pushPullable' in entity && entity.pushPullable instanceof sc.PushPullable)
        this.interactObject = entity.pushPullable
    } else this.interactObject = null

    if (state.items) this.model.items = state.items
    if (state.itemsDiff) {
        for (const idStr of Object.keys(state.itemsDiff)) {
            const id = parseInt(idStr)
            const amount = state.itemsDiff[id]
            const oldAmount = this.model.items[id]

            this.model.items[id] = amount

            if ((amount ?? 0) > (oldAmount ?? 0)) {
                notifyMapAndPlayerInsts(this.model, sc.PLAYER_MSG.ITEM_OBTAINED, {
                    id,
                    amount,
                    skip: false,
                    cutscene: undefined,
                })
            }
        }
    }

    if (state.charge !== undefined) {
        if (state.charge == 0) {
            this.charging.time = 1
            this.clearCharge()
        } else {
            this.showChargeEffect(state.charge)
        }
    }

    if (state.credit !== undefined) {
        const diff = state.credit - this.model.credit
        this.model.credit = state.credit

        if (!ig.settingStateImmediately) {
            sc.Model.notifyObserver(this.model, sc.PLAYER_MSG.CREDIT_CHANGE, diff)
        }
    }

    if (state.elementLoad !== undefined) this.model.elementLoad = state.elementLoad
    if (state.hasOverload !== undefined) this.model.hasOverload = state.hasOverload
}

prestart(() => {
    ig.ENTITY.Player.inject({ getEntityState, setEntityState })
})
