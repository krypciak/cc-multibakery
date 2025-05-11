import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'

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
    const stopSound = () => {
        ;(this.pushPullable.soundHandle as ig.SoundHandleWebAudio | undefined)?.stop()
        this.pushPullable.soundHandle = null
    }
    if (state.pos) {
        const p1 = this.coll.pos
        const p2 = state.pos
        if (!Vec3.equal(p1, p2)) {
            Vec3.assign(this.coll.pos, p2)
            this.pushPullable.soundHandle ??= sc.PushPullSounds.Loop.play(true)
        } else stopSound()
    } else stopSound()

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

    sc.PushPullable.inject({
        stopSound() {
            /* fix ig.ENTITY.PushPullBlock#update stopping the sound that was just played in setState */
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })

    ig.ENTITY.PushPullBlock.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)
