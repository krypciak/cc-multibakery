import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface PushPullBlock extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.PushPullBlock': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.PushPullBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.diffVec3(this.coll.pos),
    }
}
function setEntityState(this: ig.ENTITY.PushPullBlock, state: Return) {
    if (state.pos) {
        this.setPos(state.pos.x, state.pos.y, state.pos.z)
        if (!ig.settingStateImmediately) {
            if (!this.pushPullable.soundHandle) {
                this.pushPullable.soundHandle = sc.PushPullSounds.Loop.play(true)
            }
        }
    }
}

prestart(() => {
    ig.ENTITY.PushPullBlock.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.PushPullBlock.create = () => {
        throw new Error('ig.ENTITY.PushPullBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.PushPullBlock, isStatic: true })

    if (!REMOTE) return

    ig.ENTITY.PushPullBlock.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()
            if (!ig.lastStatePacket?.states?.[this.netid]) this.pushPullable.stopSound()
        },
        deferredUpdate() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })
}, 2)
