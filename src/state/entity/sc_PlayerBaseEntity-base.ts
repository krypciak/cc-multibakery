import { notifyMapAndPlayerInsts } from '../../server/ccmap/injects'
import { StateMemory } from '../state-util'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'
import type { u10, u7, u8 } from 'ts-binarifier/src/type-aliases'
import type { ArmorType, ExpType, ItemType, LevelType } from '../../net/binary/binary-types'

declare global {
    namespace sc {
        namespace PlayerModel {
            interface Equip {
                head: ArmorType
                leftArm: ArmorType
                rightArm: ArmorType
                torso: ArmorType
                feet: ArmorType
            }
        }
        interface PlayerModel {
            level: LevelType
            items: Record<ItemType, u10 | null>
            skillPoints: u8[]
            exp: ExpType
        }
    }
}

type Return = ReturnType<typeof getState>
export function getState(this: ig.ENTITY.Player | sc.PartyMemberEntity, memory: StateMemory) {
    return {
        modelName: memory.diff(this.model.name),

        ...igEntityCombatant.getState.call(this, memory),

        head: memory.diff(this.model.equip.head),
        leftArm: memory.diff(this.model.equip.leftArm),
        rightArm: memory.diff(this.model.equip.rightArm),
        torso: memory.diff(this.model.equip.torso),
        feet: memory.diff(this.model.equip.feet),

        level: memory.diff(this.model.level as u7),
        exp: memory.diff(this.model.exp as u10),

        element: memory.diff(this.model.currentElementMode),
    }
}

export function setState(this: ig.ENTITY.Player | sc.PartyMemberEntity, state: Return, updateStats = false) {
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
    if (state.exp !== undefined) {
        this.model.exp = state.exp
        notifyMapAndPlayerInsts(this.model, sc.PARTY_MEMBER_MSG.EXP_CHANGE)
    }

    if (updateStats) {
        // @ts-expect-error
        this.model.updateStats()
    }

    if (state.element !== undefined) {
        this.model.currentElementMode = state.element
    }
}
