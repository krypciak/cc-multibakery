import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { isRemote } from '../../server/remote/remote-server-types'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface MultiHitSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.MultiHitSwitch': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.MultiHitSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.MultiHitSwitch, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.MultiHitSwitch.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.MultiHitSwitch.create = () => {
        throw new Error('ig.ENTITY.MultiHitSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.MultiHitSwitch })
}

prestart(() => {
    if (!REMOTE) return
    ig.ENTITY.MultiHitSwitch.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()

            ig.AnimatedEntity.prototype.update.call(this)
        },
    })
}, 2)

prestart(() => {
    if (!PHYSICSNET) return
    ig.ENTITY.MultiHitSwitch.inject({
        ballHit(ballLike, blockDir) {
            return wrapCollectSounds(() => this.parent(ballLike, blockDir))
        },
    })
}, 2)
