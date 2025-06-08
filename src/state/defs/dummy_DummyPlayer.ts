import { EntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { isSameAsLast } from './entity'

declare global {
    namespace dummy {
        interface DummyPlayer {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void
            createUuid(this: this, x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): string

            lastSent?: Return
        }
        interface DummyPlayerConstructor {
            create(uuid: string, state: Return): dummy.DummyPlayer
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer, full: boolean) {
    return {
        isControlBlocked: isSameAsLast(this, full, this.data.isControlBlocked, 'isControlBlocked'),
        inCutscene: isSameAsLast(this, full, this.data.inCutscene, 'inCutscene'),
        currentMenu: isSameAsLast(this, full, this.data.currentMenu, 'currentMenu'),
        currentSubState: isSameAsLast(this, full, this.data.currentSubState, 'currentSubState'),

        pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
        currentAnim: isSameAsLast(this, full, this.currentAnim, 'currentAnim'),
        currentAnimTimer: this.animState.timer,
        face: isSameAsLast(this, full, this.face, 'face', Vec2.equal, Vec2.create),
        accelDir: isSameAsLast(this, full, this.coll.accelDir, 'accelDir', Vec2.equal, Vec2.create),
        animAlpha: isSameAsLast(this, full, this.animState.alpha, 'animAlpha'),
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.isControlBlocked !== undefined) this.data.isControlBlocked = state.isControlBlocked
    if (state.inCutscene !== undefined) this.data.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.data.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.data.currentSubState = state.currentSubState

    if (state.pos) {
        const p1 = this.coll.pos
        const p2 = state.pos
        if (!Vec3.equal(p1, p2)) {
            this.setPos(state.pos.x, state.pos.y, state.pos.z, /* fix weird animation glitches */ p1.z == p2.z)
        }
    }

    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
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

    if (state.face) this.face = state.face
    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

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
    dummy.DummyPlayer.create = (uuid: string, _state) => {
        const inputManager = new dummy.input.Puppet.InputManager()
        const username = uuid.substring(2)
        const entity = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            uuid,
            data: { username },
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
