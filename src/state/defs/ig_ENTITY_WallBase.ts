import { prestart } from '../../plugin'

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
    return {
        active: this.active ? true : undefined,
    }
}
function setState(this: ig.ENTITY.WallBase, state: Return) {
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
}, 2)
