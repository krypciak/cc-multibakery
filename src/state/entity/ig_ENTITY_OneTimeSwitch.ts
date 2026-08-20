import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { isRemote } from '../../server/remote/remote-server-types'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface OneTimeSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.OneTimeSwitch': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.OneTimeSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.OneTimeSwitch, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.OneTimeSwitch.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.OneTimeSwitch.create = () => {
        throw new Error('ig.ENTITY.OneTimeSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.OneTimeSwitch })

    if (REMOTE) {
        ig.ENTITY.OneTimeSwitch.inject({
            varsChanged() {
                if (!isRemote(multi.server)) return this.parent()
            },
        })
    }

    if (PHYSICSNET) {
        ig.ENTITY.OneTimeSwitch.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent(ballLike, blockDir))
            },
        })
    }
}, 2)
