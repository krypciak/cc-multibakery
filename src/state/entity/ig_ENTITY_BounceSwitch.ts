import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface BounceSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.BounceSwitch': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.BounceSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.BounceSwitch, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.BounceSwitch.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.BounceSwitch.create = () => {
        throw new Error('ig.ENTITY.BounceSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BounceSwitch })

    if (PHYSICSNET) {
        ig.ENTITY.BounceSwitch.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent(ballLike, blockDir))
            },
        })
    }
}, 2)
