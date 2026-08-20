import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { isRemote } from '../../server/remote/remote-server-types'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface Switch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Switch': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.Switch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.Switch, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.Switch.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.Switch.create = () => {
        throw new Error('ig.ENTITY.Switch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Switch })

    if (REMOTE) {
        ig.ENTITY.Switch.inject({
            varsChanged() {
                if (!isRemote(multi.server)) return this.parent()
            },
        })
    }

    if (PHYSICSNET) {
        ig.ENTITY.Switch.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent(ballLike, blockDir))
            },
        })
    }
}, 2)
