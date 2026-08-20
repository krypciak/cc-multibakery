import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { wrapCollectSounds } from './sound-collector'
import type { u8 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace ig.ENTITY {
        interface EnemyCounter extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.EnemyCounter': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.EnemyCounter, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        postCount: memory.diff(this.postCount as u8),
    }
}
function setEntityState(this: ig.ENTITY.EnemyCounter, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.postCount !== undefined && this.postCount != state.postCount) {
        this.postCount = state.postCount
        this.timer = this.MAX_FLASH_TIME

        if (this.postCount == 0) {
            this.done = true
        }
    }
}

prestart(() => {
    ig.ENTITY.EnemyCounter.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.EnemyCounter.create = () => {
        throw new Error('ig.ENTITY.EnemyCounter.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.EnemyCounter })

    if (PHYSICSNET) {
        ig.ENTITY.EnemyCounter.inject({
            decreaseCount() {
                return wrapCollectSounds(() => this.parent())
            },
        })
    }
}, 2)
