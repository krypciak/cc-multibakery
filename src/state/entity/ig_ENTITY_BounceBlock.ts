import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface BounceBlock extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.BounceBlock': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.BounceBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.BounceBlock, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.BounceBlock.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.BounceBlock.create = () => {
        throw new Error('ig.ENTITY.BounceBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BounceBlock })

    if (PHYSICSNET) {
        ig.ENTITY.BounceBlock.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent(ballLike, blockDir))
            },
            animationEnded(animation) {
                return wrapCollectSounds(() => this.parent(animation))
            },
        })
    }
}, 2)
