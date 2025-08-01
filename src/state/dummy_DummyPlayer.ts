import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { RemoteServer } from '../server/remote/remote-server'
import { applyDiffArray, diffArray, isSameAsLast } from './state-util'

declare global {
    namespace dummy {
        interface DummyPlayer {
            createNetid(this: this, x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): string

            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer, full: boolean) {
    const chargeLevel = this.charging.time == -1 ? 0 : this.getCurrentChargeLevel() || 1

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

        interactObject: isSameAsLast(this, full, this.interactObject?.entity?.netid, 'interactObject'),

        head: isSameAsLast(this, full, this.model.equip.head, 'head'),
        leftArm: isSameAsLast(this, full, this.model.equip.leftArm, 'leftArm'),
        rightArm: isSameAsLast(this, full, this.model.equip.rightArm, 'rightArm'),
        torso: isSameAsLast(this, full, this.model.equip.torso, 'torso'),
        feet: isSameAsLast(this, full, this.model.equip.feet, 'feet'),
        items: diffArray(this, full, this.model.items, 'items'),

        charge: isSameAsLast(this, full, chargeLevel, 'charge'),
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.isControlBlocked !== undefined) this.data.isControlBlocked = state.isControlBlocked
    if (state.inCutscene !== undefined) this.data.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.data.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.data.currentSubState = state.currentSubState

    if (state.pos) {
        Vec3.assign(this.coll.pos, state.pos)
    }

    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
        this.currentAnim = state.currentAnim

        if (
            (this.currentAnim == 'attack' || this.currentAnim == 'attackRev' || this.currentAnim == 'attackFinisher') &&
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

    if (state.interactObject) {
        const entity = ig.game.entitiesByNetid[state.interactObject]
        assert('pushPullable' in entity && entity.pushPullable instanceof sc.PushPullable)
        this.interactObject = entity.pushPullable
    } else this.interactObject = null

    if (state.head) this.model.equip.head = state.head
    if (state.leftArm) this.model.equip.leftArm = state.leftArm
    if (state.rightArm) this.model.equip.rightArm = state.rightArm
    if (state.torso) this.model.equip.torso = state.torso
    if (state.feet) this.model.equip.feet = state.feet

    if (state.items) applyDiffArray(this.model, 'items', state.items)

    if (state.charge !== undefined) {
        if (state.charge == 0) {
            this.charging.time = 1
            this.clearCharge()
        } else {
            this.showChargeEffect(state.charge)
        }
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'du'
    dummy.DummyPlayer.inject({
        getState,
        setState,
        createNetid(_x, _y, _z, settings) {
            return `${typeId}${settings.data.username}`
        },
    })
    dummy.DummyPlayer.create = (netid: string, _state) => {
        const inputManager = new dummy.input.Puppet.InputManager()
        const username = netid.substring(2)
        const entity = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            netid,
            data: { username },
            inputManager,
        })
        return entity
    }
    registerNetEntity({ entityClass: dummy.DummyPlayer, typeId })

    if (REMOTE) {
        dummy.DummyPlayer.inject({
            update() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()
            },
        })
    }
    if (PHYSICS) {
        sc.Combat.inject({
            showCharge(target, chargeLevelEffectName, element) {
                if (!(multi.server instanceof PhysicsServer)) return this.parent(target, chargeLevelEffectName, element)

                assert(!ig.ignoreEffectNetid)
                ig.ignoreEffectNetid = true
                const ret = this.parent(target, chargeLevelEffectName, element)
                ig.ignoreEffectNetid = false
                return ret
            },
        })
    }
}, 2)
