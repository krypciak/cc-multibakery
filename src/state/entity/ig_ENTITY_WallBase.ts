import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface WallBase extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WallBase': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.WallBase, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const timer = this.wallBlockers[0]?.timer
    return {
        active: memory.diff(this.active),
        timer: memory.diff(timer),
    }
}
function setState(this: ig.ENTITY.WallBase, state: Return) {
    if (state.timer !== undefined) {
        for (const wallBlocker of this.wallBlockers) {
            wallBlocker.timer = state.timer
        }
    }
    if (state.active !== undefined && this.active != state.active) {
        this.active = state.active
        this.updateWallBlockers()
    }
}

prestart(() => {
    ig.ENTITY.WallBase.inject({
        getState,
        setState,
    })
    ig.ENTITY.WallBase.create = () => {
        throw new Error('ig.ENTITY.WallBase.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.WallBase, netidStatic: true })

    ig.ENTITY.WallBlocker.inject({
        setActive(isBaseActive, isActive) {
            if (!ig.settingStateImmediately) return this.parent(isBaseActive, isActive)

            const soundsBackup = this.sounds
            this.sounds = undefined
            this.parent(isBaseActive, isActive)
            this.sounds = soundsBackup
        },
    })

    if (!REMOTE) return

    ig.ENTITY.WallBlocker.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            /* prevent this.timer from ticking */
        },
    })
}, 2)
