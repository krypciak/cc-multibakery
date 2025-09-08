import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'

declare global {
    namespace ig.ENTITY {
        interface Player extends StateMemory.MapHolder<StateKey> {}
    }
}

function getSkills(this: ig.ENTITY.Player): number[] {
    const skillCount = this.model.skills.length
    const skills = new Array(skillCount)
    for (let i = 0; i < skillCount; i++) {
        skills[i] = this.model.skills[i] ? 1 : 0
    }
    return skills
}

function setSkills(this: ig.ENTITY.Player, skills: Record<number, number>) {
    for (const idStr in skills) {
        const id = parseInt(idStr)
        this.model.skills[id] = skills[id] ? sc.skilltree.skills[id] : null
    }
}

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Player, player?: StateKey, memory?: StateMemory) {
    const chargeLevel = this.charging.time == -1 ? 0 : this.getCurrentChargeLevel() || 1

    memory ??= StateMemory.getBy(this, player)
    return {
        ...igEntityCombatant.getState.call(this, memory),

        interactObject: memory.diff(this.interactObject?.entity?.netid),

        head: memory.diff(this.model.equip.head),
        leftArm: memory.diff(this.model.equip.leftArm),
        rightArm: memory.diff(this.model.equip.rightArm),
        torso: memory.diff(this.model.equip.torso),
        feet: memory.diff(this.model.equip.feet),

        level: memory.diff(this.model.level),
        items: !player || this == player.dummy ? memory.diffRecord(this.model.items) : undefined,
        skillPoints: !player || this == player.dummy ? memory.diffRecord(this.model.skillPoints) : undefined,
        skills: !player || this == player.dummy ? memory.diffRecord(getSkills.call(this)) : undefined,

        charge: memory.diff(chargeLevel),
        element: memory.diff(this.model.currentElementMode),
    }
}

export function setState(this: ig.ENTITY.Player, state: Return) {
    igEntityCombatant.setState.call(this, state)

    if (state.spLevel !== undefined) {
        this.model.spLevel = state.spLevel
    }

    /* footstep sounds */
    function getSoundFromColl(coll: ig.CollEntry, type: keyof typeof sc.ACTOR_SOUND): sc.ACTOR_SOUND_BASE {
        var c = ig.terrain.getTerrain(coll, true, true),
            e = sc.ACTOR_SOUND[type] || sc.ACTOR_SOUND.none
        return (e as any)[c] ?? e[ig.TERRAIN_DEFAULT]
    }
    if (
        !this.jumping &&
        !this.animationFixed &&
        this.stepFx.frames &&
        !Vec2.isZero(this.coll.accelDir) &&
        this.coll.relativeVel >= ig.ACTOR_RUN_THRESHOLD
    ) {
        const frame = this.animState.getFrame()
        if (frame != this.stepFx.lastFrame) {
            const sound = getSoundFromColl(this.coll, this.soundType)
            if (frame == this.stepFx.frames[0]) {
                ig.SoundHelper.playAtEntity(sound.step1!, this, null, null, 700)
            } else if (frame == this.stepFx.frames[1]) {
                ig.SoundHelper.playAtEntity(sound.step2!, this, null, null, 700)
            }
            this.stepFx.lastFrame = frame
        }
    } else this.stepFx.lastFrame = -1

    if (state.interactObject) {
        const entity = ig.game.entitiesByNetid[state.interactObject]
        assert('pushPullable' in entity && entity.pushPullable instanceof sc.PushPullable)
        this.interactObject = entity.pushPullable
    } else this.interactObject = null

    let updateStats = false
    // prettier-ignore
    {
        if (state.head !== undefined) { updateStats = true; this.model.equip.head = state.head }
        if (state.leftArm !== undefined) { updateStats = true; this.model.equip.leftArm = state.leftArm }
        if (state.rightArm !== undefined) { updateStats = true; this.model.equip.rightArm = state.rightArm }
        if (state.torso !== undefined) { updateStats = true; this.model.equip.torso = state.torso }
        if (state.feet !== undefined) { updateStats = true; this.model.equip.feet = state.feet }
    }

    if (state.level !== undefined) {
        this.model.level = state.level
        /* I don't want to even start thinking about making this unique for every player */
        sc.inventory.updateScaledEquipment(state.level)
        notifyMapAndPlayerInsts(this.model, sc.PLAYER_MSG.LEVEL_CHANGE, null)
    }
    if (state.items) StateMemory.applyChangeRecord(this.model.items, state.items)
    if (state.skillPoints) StateMemory.applyChangeRecord(this.model.skillPoints, state.skillPoints)
    if (state.skills) {
        setSkills.call(this, state.skills)
        updateStats = true
    }

    if (updateStats) {
        this.model.updateStats()
    }

    if (state.charge !== undefined) {
        if (state.charge == 0) {
            this.charging.time = 1
            this.clearCharge()
        } else {
            this.showChargeEffect(state.charge)
        }
    }
    if (state.element !== undefined) {
        this.model.currentElementMode = state.element
    }
}

prestart(() => {
    ig.ENTITY.Player.inject({ getState, setState })
})
