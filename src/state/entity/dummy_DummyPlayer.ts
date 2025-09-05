import { assert } from '../../misc/assert'
import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateKey } from '../states'
import { shouldCollectStateData, StateMemory } from '../state-util'
import * as igEntityPlayer from './ig_ENTITY_Player-base'

declare global {
    namespace dummy {
        interface DummyPlayer {
            createNetid(this: this, x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): string
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        ...igEntityPlayer.getState.call(this, player, memory),

        isControlBlocked: memory.diff(this.data.isControlBlocked),
        inCutscene: memory.diff(this.data.inCutscene),
        currentMenu: memory.diff(this.data.currentMenu),
        currentSubState: memory.diff(this.data.currentSubState),
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
        if (
            (state.currentAnim == 'attack' ||
                state.currentAnim == 'attackRev' ||
                state.currentAnim == 'attackFinisher') &&
            this.inputManager.inputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE &&
            this.model.getCore(sc.PLAYER_CORE.THROWING) &&
            sc.options.get('close-circle')
        ) {
            this.gui.crosshair.setCircleGlow()
        }
    }

    igEntityPlayer.setState.call(this, state)

    if (state.isControlBlocked !== undefined) this.data.isControlBlocked = state.isControlBlocked
    if (state.inCutscene !== undefined) this.data.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.data.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.data.currentSubState = state.currentSubState
}

const typeId: EntityTypeId = 'du'
export function createDummyNetid(username: string) {
    return `${typeId}${username}`
}

prestart(() => {
    dummy.DummyPlayer.inject({
        getState,
        setState,
        createNetid(_x, _y, _z, settings) {
            return createDummyNetid(settings.data.username)
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
                if (!shouldCollectStateData()) return this.parent(target, chargeLevelEffectName, element)

                assert(!ig.ignoreEffectNetid)
                ig.ignoreEffectNetid = true
                const ret = this.parent(target, chargeLevelEffectName, element)
                ig.ignoreEffectNetid = false
                return ret
            },
        })
    }
}, 2)
