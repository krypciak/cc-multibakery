import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'

export {}
declare global {
    namespace dummy {
        interface DummyPlayer {
            type: 'dummy.DummyPlayer'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface DummyPlayerConstructor {
            create(uuid: string, state: Return): dummy.DummyPlayer
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: dummy.DummyPlayer) {
    return {
        data: this.data,
        pos: this.coll.pos,
        currentAnim: this.currentAnim,
        currentAnimTimer: this.animState.timer,
        face: this.face,
        accelDir: this.coll.accelDir,
    }
}
function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.data) this.data = state.data
    if (state.pos) {
        const p1 = this.coll.pos
        const p2 = state.pos
        if (!Vec3.equal(p1, p2)) {
            this.setPos(state.pos.x, state.pos.y, state.pos.z, /* fix weird animation glitches */ p1.z == p2.z)
        }
    }
    if (state.currentAnim) this.currentAnim = state.currentAnim
    if (state.currentAnimTimer) this.animState.timer = state.currentAnimTimer
    if (state.face) this.face = state.face
    if (state.accelDir) this.coll.accelDir = state.accelDir

    this.gui.crosshair.controller.isAimingOverride

    this.updateAnim()

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
}

prestart(() => {
    dummy.DummyPlayer.inject({ getState, setState })
    dummy.DummyPlayer.create = (uuid: string, state) => {
        const inputManager = new dummy.input.Puppet.InputManager()
        assert(state.data)
        const entity = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            uuid,
            data: state.data,
            inputManager,
        })
        return entity
    }

    dummy.DummyPlayer.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)
