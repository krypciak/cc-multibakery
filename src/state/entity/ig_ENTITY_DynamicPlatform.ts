import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { isRemote } from '../../server/remote/remote-server-types'

declare global {
    namespace ig.ENTITY {
        interface DynamicPlatform extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.DynamicPlatform': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.DynamicPlatform, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.DynamicPlatform, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.DynamicPlatform.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.DynamicPlatform.create = () => {
        throw new Error('ig.ENTITY.DynamicPlatform.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.DynamicPlatform })

    if (REMOTE) {
        ig.ENTITY.DynamicPlatform.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
                if (!ig.shared.settingState) return

                this.parent()
            },
        })
    }
}, 2)
