import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createNetidStatic } from './entity'
import { StateMemory } from './state-util'
import { ServerPlayer } from '../server/server-player'

declare global {
    namespace ig.ENTITY {
        interface PushPullBlock {
            lastSent?: WeakMap<ServerPlayer, StateMemory>
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.PushPullBlock, player: ServerPlayer) {
    const memory = StateMemory.getStateMemory(this, player)

    return {
        pos: memory.isSameAsLast(this.coll.pos, Vec3.equal, Vec3.create),
    }
}
function setState(this: ig.ENTITY.PushPullBlock, state: Return) {
    if (state.pos) {
        if (multi.server) {
            Vec3.assign(this.coll.pos, state.pos)
        } else {
            this.setPos(state.pos.x, state.pos.y, state.pos.z)
        }
        if (!ig.settingStateImmediately) {
            if (!this.pushPullable.soundHandle) {
                this.pushPullable.soundHandle = sc.PushPullSounds.Loop.play(true)
            }
        }
    } else this.pushPullable.stopSound()
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

    ig.ENTITY.PushPullBlock.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
        deferredUpdate() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
