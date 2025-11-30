import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import type { StateKey } from '../states'
import { shouldCollectStateData, StateMemory } from '../state-util'
import * as igEntityPlayer from './ig_ENTITY_Player-base'
import type { f32, u32 } from 'ts-binarifier/src/type-aliases'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    interface EntityStates {
        'dummy.DummyPlayer': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: dummy.DummyPlayer, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        ...igEntityPlayer.getState.call(this, player, memory),

        username: memory.diff(this.data.username),
        skin: memory.diff(this.currentSkinName ?? ''),
        isControlBlocked: memory.diff(this.data.isControlBlocked),
        inCutscene: memory.diff(this.data.inCutscene),
        currentMenu: memory.diff(this.data.currentMenu as u32),
        currentSubState: memory.diff(this.data.currentSubState),

        combatArtLabelText: memory.diff(this.combatArtLabelText),
        combatantLabelText: memory.diff(this.combatantLabelInfo?.text),
        combatantLabelTimer: memory.diff(this.combatantLabelInfo?.time as f32),
        showElementalOverloadLabel: memory.diff(this.model.showElementalOverloadLabel),
        showNoSpLabel: memory.diff(this.showNoSpLabel),
    }
}

function setState(this: dummy.DummyPlayer, state: Return) {
    igEntityPlayer.setState.call(this, state)

    if (state.skin !== undefined) {
        this.setSkin(state.skin, true)
    }

    if (state.isControlBlocked !== undefined) this.data.isControlBlocked = state.isControlBlocked
    if (state.inCutscene !== undefined) this.data.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.data.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.data.currentSubState = state.currentSubState

    if (state.combatArtLabelText !== undefined) this.combatArtLabelText = state.combatArtLabelText
    if (state.combatantLabelText !== undefined) {
        this.combatantLabelInfo = {
            text: state.combatantLabelText,
            time: state.combatantLabelTimer,
        }
    }
    if (state.showElementalOverloadLabel !== undefined)
        this.model.showElementalOverloadLabel = state.showElementalOverloadLabel
    if (state.showNoSpLabel !== undefined) this.showNoSpLabel = state.showNoSpLabel
}

prestart(() => {
    dummy.DummyPlayer.inject({
        getState,
        setState,
        createNetid() {
            if (isRemote(multi.server)) return
            return this.parent()
        },
    })
    dummy.DummyPlayer.create = (netid: EntityNetid, state: Return) => {
        const username = state.username
        assert(username)

        const player = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            netid,
            data: { username },
            inputManager: new dummy.input.Puppet.InputManager(),
        })

        const client = multi.server.clients.get(username)
        client?.playerAttachResolve?.(player)

        return player
    }
    registerNetEntity({ entityClass: dummy.DummyPlayer })

    if (REMOTE) {
        dummy.DummyPlayer.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
                ig.AnimatedEntity.prototype.update.call(this)
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
