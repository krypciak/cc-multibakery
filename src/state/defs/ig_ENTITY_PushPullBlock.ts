import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote-server'

export {}
declare global {
    namespace ig.ENTITY {
        interface PushPullBlock {
            type: 'ig.ENTITY.PushPullBlock'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface PushPullBlockConstructor {
            create(uuid: string, state: Return): ig.ENTITY.PushPullBlock
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: ig.ENTITY.PushPullBlock) {
    return {
        pos: this.coll.pos,
    }
}
function setState(this: ig.ENTITY.PushPullBlock, state: Return) {
    if (state.pos) {
        const p1 = this.coll.pos
        const p2 = state.pos
        if (!Vec3.equal(p1, p2)) {
            Vec3.assign(this.coll.pos, p2)
        }
    }
    this.update()
}

prestart(() => {
    ig.ENTITY.PushPullBlock.inject({ getState, setState })
    ig.ENTITY.PushPullBlock.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.PushPullBlock.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.PushPullBlock, ig.ENTITY.PushPullBlock.Settings>(
        //     ig.ENTITY.PushPullBlock,
        //     0,
        //     0,
        //     0,
        //     {
        //         uuid,
        //     }
        // )
        // return entity
    }

    ig.ENTITY.PushPullBlock.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)
