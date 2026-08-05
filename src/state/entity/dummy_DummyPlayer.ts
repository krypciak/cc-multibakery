import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import type { StateKey } from '../map-state-handlers'
import { shouldCollectStateData, StateMemory } from '../state-util'
import * as igEntityPlayer from './ig_ENTITY_Player-base'
import type { u32 } from 'ts-binarifier/src/type-aliases'
import { isRemote } from '../../server/remote/remote-server-types'
import { wrapIgnoreEffectNetid } from './effect-netid'

declare global {
    namespace dummy {
        interface DummyPlayer extends StateMemory.MapHolder<StateKey> {}
        interface DummyPlayerConstructor {
            create(netid: EntityNetid, state: Partial<Return>): dummy.DummyPlayer
        }
    }
    interface EntityStates {
        'dummy.DummyPlayer': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: dummy.DummyPlayer, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        ...igEntityPlayer.getEntityState.call(this, player, memory),

        username: memory.diff(this.username),
        skin: memory.diff(this.currentSkinName ?? ''),
        remoteForceBlockControl: memory.diff(this.remoteForceBlockControl),
        inCutscene: memory.diff(this.inCutscene),
        currentMenu: memory.diff(this.currentMenu as u32),
        currentSubState: memory.diff(this.currentSubState),

        combatArtLabelText: memory.diff(this.combatArtLabelText),
        showElementalOverloadLabel: memory.diff(this.model.showElementalOverloadLabel),
        showNoSpLabel: memory.diff(this.showNoSpLabel),
    }
}

function setEntityState(this: dummy.DummyPlayer, state: Return) {
    igEntityPlayer.setEntityState.call(this, state)

    if (state.skin !== undefined) {
        this.setSkin(state.skin, true)
    }

    if (state.remoteForceBlockControl !== undefined) this.remoteForceBlockControl = state.remoteForceBlockControl
    if (state.inCutscene !== undefined) this.inCutscene = state.inCutscene
    if (state.currentMenu !== undefined) this.currentMenu = state.currentMenu
    if (state.currentSubState !== undefined) this.currentSubState = state.currentSubState

    if (state.combatArtLabelText !== undefined) this.combatArtLabelText = state.combatArtLabelText
    if (state.showElementalOverloadLabel !== undefined)
        this.model.showElementalOverloadLabel = state.showElementalOverloadLabel
    if (state.showNoSpLabel !== undefined) this.showNoSpLabel = state.showNoSpLabel
}

prestart(() => {
    dummy.DummyPlayer.inject({
        getEntityState,
        setEntityState,
    })
    dummy.DummyPlayer.create = (netid: EntityNetid, state: Return) => {
        const username = state.username
        assert(username)

        const player = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            netid,
            username,
            inputManager: new dummy.input.Puppet.InputManager(),
        })

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

                return wrapIgnoreEffectNetid(() => this.parent(target, chargeLevelEffectName, element))
            },
        })
    }
}, 2)
