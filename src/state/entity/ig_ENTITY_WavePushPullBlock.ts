import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { isRemote } from '../../server/remote/remote-server-types'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface WavePushPullBlock extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WavePushPullBlock': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.WavePushPullBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.WavePushPullBlock, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.pos && !ig.shared.settingStateImmediately && !this.pushPullable.soundHandle) {
        this.pushPullable.soundHandle = sc.PushPullSounds.Loop.play(true)
    }
}

prestart(() => {
    ig.ENTITY.WavePushPullBlock.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.WavePushPullBlock.create = () => {
        throw new Error('ig.ENTITY.WavePushPullBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.WavePushPullBlock })

    if (!REMOTE) return

    ig.ENTITY.WavePushPullBlock.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()
            if (!ig.mapShared.lastStatePacket?.states?.[this.netid]) this.pushPullable.stopSound()
        },
        deferredUpdate() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })
}, 2)
