import { assert } from '../../misc/assert'
import { EntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'

declare global {
    namespace dummy {
        interface DummyPlayer {
            getState(this: this): Return
            setState(this: this, state: Return): void
            createUuid(this: this, x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): string
        }
        interface DummyPlayerConstructor {
            create(uuid: string, state: Return): dummy.DummyPlayer
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer) {
    return {
        data: this.data,
        pos: this.coll.pos,
        currentAnim: this.currentAnim,
        currentAnimTimer: this.animState.timer,
        face: this.face,
        accelDir: Vec2.isZero(this.coll.accelDir) ? undefined : this.coll.accelDir,
        animAlpha: this.animState.alpha == 1 ? undefined : this.animState.alpha,
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    this.data = state.data
    const p1 = this.coll.pos
    const p2 = state.pos
    if (!Vec3.equal(p1, p2)) {
        this.setPos(state.pos.x, state.pos.y, state.pos.z, /* fix weird animation glitches */ p1.z == p2.z)
    }
    if (this.currentAnim != state.currentAnim) {
        this.currentAnim = state.currentAnim

        if (
            (this.currentAnim == 'attack' || this.currentAnim == 'attackRev' || this.currentAnim == 'attackFinisher') &&
            multi.server instanceof RemoteServer &&
            this.inputManager.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE &&
            this.model.getCore(sc.PLAYER_CORE.THROWING) &&
            sc.options.get('close-circle')
        ) {
            this.gui.crosshair.setCircleGlow()
        }
    }
    this.animState.timer = state.currentAnimTimer

    this.face = state.face
    this.coll.accelDir = state.accelDir ?? Vec3.create()
    this.animState.alpha = state.animAlpha ?? 1

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
    const typeId: EntityTypeId = 'du'
    dummy.DummyPlayer.inject({
        getState,
        setState,
        createUuid(_x, _y, _z, settings) {
            return `${typeId}${settings.data.username}`
        },
    })
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
    ig.registerEntityTypeId(dummy.DummyPlayer, typeId)

    dummy.DummyPlayer.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)
