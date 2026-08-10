import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { StateMemory } from '../state-util'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'
import type { u10, u7 } from 'ts-binarifier/src/type-aliases'
import { assert } from '../../misc/assert'
import { isRemote } from '../../server/remote/remote-server-types'
import type { StateKey } from '../map-state-handlers'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.ENTITY.Player | sc.PartyMemberEntity, memory: StateMemory, player?: StateKey) {
    /* model can be null for sc.PartyMemberEntity right after leaving the party */
    const model = this.model as typeof this.model | undefined
    return {
        ...igEntityCombatant.getEntityState.call(this, player, memory),

        modelName: model && memory.diff(model.name),

        head: model && memory.diff(model.equip.head),
        leftArm: model && memory.diff(model.equip.leftArm),
        rightArm: model && memory.diff(model.equip.rightArm),
        torso: model && memory.diff(model.equip.torso),
        feet: model && memory.diff(model.equip.feet),

        level: model && memory.diff(model.level as u7),
        exp: model && memory.diff(model.exp as u10),

        element: model && memory.diff(model.currentElementMode),

        multiParty: memory.diff(this.multiParty?.id),
    }
}

export function setEntityState(this: ig.ENTITY.Player | sc.PartyMemberEntity, state: Return, updateStats = false) {
    igEntityCombatant.setEntityState.call(this, state)

    if (state.spLevel !== undefined) {
        this.model.spLevel = state.spLevel
    }

    // prettier-ignore
    {
        if (state.head !== undefined) { updateStats = true; this.model.equip.head = state.head }
        if (state.leftArm !== undefined) { updateStats = true; this.model.equip.leftArm = state.leftArm }
        if (state.rightArm !== undefined) { updateStats = true; this.model.equip.rightArm = state.rightArm }
        if (state.torso !== undefined) { updateStats = true; this.model.equip.torso = state.torso }
        if (state.feet !== undefined) { updateStats = true; this.model.equip.feet = state.feet }
    }

    let setParams = false
    if (state.level !== undefined) {
        this.model.level = state.level
        /* I don't want to even start thinking about making this unique for every player */
        sc.inventory.updateScaledEquipment(state.level)

        updateStats = true
        if (ig.shared.settingStateImmediately || state.firstState) setParams = true
        else notifyMapAndPlayerInsts(this.model, sc.PLAYER_MSG.LEVEL_CHANGE, null)
    }
    if (state.exp !== undefined) {
        this.model.exp = state.exp

        if (ig.shared.settingStateImmediately || state.firstState) setParams = true
        else notifyMapAndPlayerInsts(this.model, sc.PARTY_MEMBER_MSG.EXP_CHANGE)
    }

    if (updateStats) {
        // @ts-expect-error
        this.model.updateStats()
    }

    if (setParams) notifyMapAndPlayerInsts(this.model, sc.PLAYER_MSG.SET_PARAMS)

    if (state.element !== undefined) {
        this.model.currentElementMode = state.element
    }

    if (state.multiParty !== undefined && isRemote(multi.server)) {
        this.multiParty = multi.server.party.parties[state.multiParty]
        assert(this.multiParty)
    }
}
