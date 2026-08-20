import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'

declare global {
    namespace ig.ENTITY {
        interface RegenDestruct extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.RegenDestruct': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.RegenDestruct, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.RegenDestruct, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.RegenDestruct.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.RegenDestruct.create = () => {
        throw new Error('ig.ENTITY.RegenDestruct.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.RegenDestruct })

    if (PHYSICSNET) {
        ig.ENTITY.RegenDestruct.inject({
            ballHit(ballLike, blockDir) {
                return wrapCollectSounds(() => this.parent!(ballLike, blockDir))
            },
        })
    }
}, 2)
