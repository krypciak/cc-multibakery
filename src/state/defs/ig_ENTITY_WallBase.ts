import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'

export {}
declare global {
    namespace ig.ENTITY {
        interface WallBase {
            type: 'ig.ENTITY.WallBase'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface WallBaseConstructor {
            create(uuid: string, state: Return): ig.ENTITY.WallBase
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: ig.ENTITY.WallBase) {
    const timer = this.wallBlockers[0]?.timer
    return {
        active: this.active ? true : undefined,
        timer: timer > 0 ? timer : undefined,
    }
}
function setState(this: ig.ENTITY.WallBase, state: Return) {
    const timer = state.timer ?? 0
    for (const wallBlocker of this.wallBlockers) {
        wallBlocker.timer = timer
    }
    const active = !!state.active
    if (this.active != active) {
        this.active = active
        this.updateWallBlockers()
    }
}

prestart(() => {
    ig.ENTITY.WallBase.inject({ getState, setState })
    ig.ENTITY.WallBase.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.WallBase.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.WallBase, ig.ENTITY.WallBase.Settings>(
        //     ig.ENTITY.WallBase,
        //     0,
        //     0,
        //     0,
        //     {
        //         uuid,
        //     }
        // )
        // return entity
    }

    ig.ENTITY.WallBlocker.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            /* prevent this.timer from ticking */
        },
        setActive(isBaseActive, isActive) {
            if (!ig.settingStateImmediately) return this.parent(isBaseActive, isActive)

            const soundsBackup = this.sounds
            this.sounds = undefined
            this.parent(isBaseActive, isActive)
            this.sounds = soundsBackup
        },
    })
}, 2)
