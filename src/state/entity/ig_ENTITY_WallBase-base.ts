import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface WallBase extends StateMemory.MapHolder<StateKey> {}
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

export type WallBaseReturn = Return

prestart(() => {
    ig.ENTITY.WallBase.inject({
        getState,
        setState,
    })

    ig.ENTITY.WallBlocker.inject({
        setActive(active, noEffects) {
            return this.parent(active, noEffects || ig.settingStateImmediately)
        },
    })

    if (!REMOTE) return

    ig.ENTITY.WallBlocker.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            /* prevent this.timer from ticking */
        },
    })

    ig.ENTITY.WallBase.inject({
        varsChanged() {
            if (!(multi.server instanceof RemoteServer)) return this.parent!()
        },
    })
}, 2)
