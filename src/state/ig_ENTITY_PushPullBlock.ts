import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createNetidStatic } from './entity'
import { isSameAsLast } from './state-util'

declare global {
    namespace ig.ENTITY {
        interface PushPullBlock {
            lastSent?: Return
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.PushPullBlock, full: boolean) {
    return {
        pos: isSameAsLast(this, full, this.coll.pos, 'pos', Vec3.equal, Vec3.create),
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
            if (multi.server) {
                Vec3.assign(this.coll.pos, p2)
            } else {
                this.setPos(p2.x, p2.y, p2.z)
            }
            /* TODO: push sound looping */
            this.pushPullable.soundHandle ??= sc.PushPullSounds.Loop.play(true)
        } else stopSound()
    }

    this.update()
}

prestart(() => {
    const typeId: EntityTypeId = 'pp'
    ig.ENTITY.PushPullBlock.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.PushPullBlock.create = () => {
        throw new Error('ig.ENTITY.PushPullBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.PushPullBlock, typeId, sendEmpty: true, netidStatic: true })

    if (!REMOTE) return

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

prestart(() => {
    if (!REMOTE) return

    sc.PushPullable.inject({
        onUpdate() {
            if (!(multi.server instanceof RemoteServer) || !ig.game.playerEntity) return this.parent()
            /* dont let it change the player position */
            const backupPos = Vec3.create(ig.game.playerEntity.coll.pos)
            assert(backupPos)
            this.parent()
            Vec3.assign(ig.game.playerEntity.coll.pos, backupPos)
        },
        onDeferredUpdate() {
            if (!(multi.server instanceof RemoteServer) || !ig.game.playerEntity) return this.parent()
            /* dont let it change the player position */
            const backupPos = Vec3.create(ig.game.playerEntity.coll.pos)
            assert(backupPos)
            this.parent()
            Vec3.assign(ig.game.playerEntity.coll.pos, backupPos)
        },
    })
})
