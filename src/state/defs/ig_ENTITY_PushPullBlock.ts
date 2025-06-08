import { EntityTypeId, registerEntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createUuidStaticEntity, isSameAsLast } from './entity'

declare global {
    namespace ig.ENTITY {
        interface PushPullBlock {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void

            lastSent?: Return
        }
        interface PushPullBlockConstructor {
            create(uuid: string, state: Return): ig.ENTITY.PushPullBlock
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.PushPullBlock, full: boolean) {
    return {
        pos: isSameAsLast(this, full, this.coll.pos, 'pos'),
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
        createUuid(x, y, z, settings) {
            return createUuidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.PushPullBlock.create = () => {
        throw new Error('ig.ENTITY.PushPullBlock.create not implemented')
    }
    registerEntityTypeId(ig.ENTITY.PushPullBlock, typeId, undefined, true)

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
