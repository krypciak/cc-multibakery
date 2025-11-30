import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import type { u8 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace ig.ENTITY {
        interface EnemyCounter extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.EnemyCounter': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.EnemyCounter, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        postCount: memory.diff(this.postCount as u8),
    }
}
function setState(this: ig.ENTITY.EnemyCounter, state: Return) {
    if (state.postCount !== undefined && this.postCount != state.postCount) {
        this.postCount = state.postCount
        this.timer = this.MAX_FLASH_TIME

        if (this.postCount == 0) {
            this.done = true
        }
        if (!ig.settingStateImmediately) {
            if (this.done) {
                ig.SoundHelper.playAtEntity(this.sounds.done, this)
            } else {
                ig.SoundHelper.playAtEntity(this.sounds.count, this)
            }
        }
    }
}

prestart(() => {
    ig.ENTITY.EnemyCounter.inject({
        getState,
        setState,
    })
    ig.ENTITY.EnemyCounter.create = () => {
        throw new Error('ig.ENTITY.EnemyCounter.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.EnemyCounter, isStatic: true })
}, 2)
