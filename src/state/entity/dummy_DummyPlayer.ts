import { assert } from '../../misc/assert'
import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../plugin'
import { PhysicsServer } from '../../server/physics/physics-server'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateKey } from '../states'
import { StateMemory } from '../state-util'
import { runTasks } from 'cc-instanceinator/src/inst-util'
import * as scActorEntity from './sc_ActorEntity-base'

declare global {
    namespace dummy {
        interface DummyPlayer extends StateMemory.MapHolder<StateKey> {
            createNetid(this: this, x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): string
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer, player?: StateKey) {
    const chargeLevel = this.charging.time == -1 ? 0 : this.getCurrentChargeLevel() || 1

    const memory = StateMemory.getBy(this, player)
    return {
        isControlBlocked: memory.diff(this.data.isControlBlocked),
        inCutscene: memory.diff(this.data.inCutscene),
        currentMenu: memory.diff(this.data.currentMenu),
        currentSubState: memory.diff(this.data.currentSubState),

        ...scActorEntity.getState.call(this, memory),

        interactObject: memory.diff(this.interactObject?.entity?.netid),

        head: memory.diff(this.model.equip.head),
        leftArm: memory.diff(this.model.equip.leftArm),
        rightArm: memory.diff(this.model.equip.rightArm),
        torso: memory.diff(this.model.equip.torso),
        feet: memory.diff(this.model.equip.feet),
        items: this == player?.dummy ? memory.diffStaticArray(this.model.items) : undefined,

        charge: memory.diff(chargeLevel),

        hp: memory.diff(this.model.params.currentHp),
        baseParams: memory.diffRecord(this.model.params.baseParams),
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.isControlBlocked !== undefined) this.data.isControlBlocked = state.isControlBlocked
    if (state.inCutscene !== undefined) this.data.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.data.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.data.currentSubState = state.currentSubState

    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
        const anim = state.currentAnim

        if (
            (anim == 'attack' || anim == 'attackRev' || anim == 'attackFinisher') &&
            this.inputManager.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE &&
            this.model.getCore(sc.PLAYER_CORE.THROWING) &&
            sc.options.get('close-circle')
        ) {
            this.gui.crosshair.setCircleGlow()
        }
    }

    scActorEntity.setState.call(this, state)

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

    if (state.items) StateMemory.applyDiffStaticArray(this.model, 'items', state.items)

    if (state.charge !== undefined) {
        if (state.charge == 0) {
            this.charging.time = 1
            this.clearCharge()
        } else {
            this.showChargeEffect(state.charge)
        }
    }

    function notify(model: sc.Model, msg: number, data?: unknown) {
        sc.Model.notifyObserver(model, msg)
        if (ig.ccmap) {
            runTasks(ig.ccmap.getAllInstances(), () => {
                sc.Model.notifyObserver(model, sc.COMBAT_PARAM_MSG.HP_CHANGED, data)
            })
        }
    }

    if (state.hp !== undefined) {
        this.model.params.currentHp = state.hp
        notify(this.params, sc.COMBAT_PARAM_MSG.HP_CHANGED)
        console.log(state.hp)
    }

    if (state.baseParams !== undefined) {
        StateMemory.applyChangeRecord(this.model.baseParams, state.baseParams)
        notify(this.model.params, sc.COMBAT_PARAM_MSG.STATS_CHANGED)
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
    if (PHYSICSNET) {
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
