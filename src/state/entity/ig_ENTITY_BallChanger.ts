import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface BallChanger extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.BallChanger': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.BallChanger, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.BallChanger, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.BallChanger.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.BallChanger.create = () => {
        throw new Error('ig.ENTITY.BallChanger.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BallChanger })

    if (PHYSICSNET) {
        ig.ENTITY.BallChanger.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent(ballLike, blockDir))
            },
        })
    }
}, 2)
