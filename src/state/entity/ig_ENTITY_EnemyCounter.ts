import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import { u8 } from 'ts-binarifier/src/type-aliases'

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
    if (state.postCount !== undefined) {
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
    const typeId: EntityTypeId = 'ec'
    ig.ENTITY.EnemyCounter.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.EnemyCounter.create = () => {
        throw new Error('ig.ENTITY.EnemyCounter.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.EnemyCounter, typeId, netidStatic: true })
}, 2)
