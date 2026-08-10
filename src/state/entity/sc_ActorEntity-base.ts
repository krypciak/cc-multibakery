import { prestart } from '../../loading-stages'
import type { StateKey } from '../map-state-handlers'
import { StateMemory } from '../state-util'
import * as igActorEntity from './ig_ActorEntity-base'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: sc.ActorEntity, player: StateKey | undefined, memory: StateMemory) {
    return {
        ...igActorEntity.getEntityState.call(this, player, memory),

        face: memory.diffVec2(this.face),
        jumpedWithSound: this.lastJumpWithSoundsFrame == ig.system.frame - 1,
    }
}

export function setEntityState(this: sc.ActorEntity, state: Return) {
    igActorEntity.setEntityState.call(this, state)

    if (state.face) this.face = state.face

    /* footstep sounds */
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
                ig.SoundHelper.playAtEntity(sound.step1, this, null, null, 700)
            } else if (frame == this.stepFx.frames[1]) {
                ig.SoundHelper.playAtEntity(sound.step2, this, null, null, 700)
            }
            this.stepFx.lastFrame = frame
        }
    } else this.stepFx.lastFrame = -1

    if (state.jumpedWithSound) {
        const sound = getSoundFromColl(this.coll, this.soundType)
        ig.SoundHelper.playAtEntity(sound.jump, this, null, null, 700)
    }
}

declare global {
    namespace sc {
        interface ActorEntity {
            lastJumpWithSoundsFrame?: number
        }
    }
}
prestart(() => {
    sc.ActorEntity.inject({
        onJump(addedHeight, ignoreSounds) {
            this.parent(addedHeight, ignoreSounds)
            if (!ignoreSounds) this.lastJumpWithSoundsFrame = ig.system.frame
        },
    })
})

function getSoundFromColl(coll: ig.CollEntry, type: keyof typeof sc.ACTOR_SOUND): sc.ACTOR_SOUND_BASE {
    var c = ig.terrain.getTerrain(coll, true, true),
        e = sc.ACTOR_SOUND[type] || sc.ACTOR_SOUND.none
    return (e as any)[c] ?? e[ig.TERRAIN_DEFAULT]
}
