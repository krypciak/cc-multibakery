import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { isRemote } from '../../server/remote/remote-server-types'

declare global {
    namespace ig.ENTITY {
        interface ElementPoleDest extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.ElementPoleDest': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.ElementPoleDest, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.ElementPoleDest, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.ElementPoleDest.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.ElementPoleDest.create = () => {
        throw new Error('ig.ENTITY.ElementPoleDest.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.ElementPoleDest })
}

prestart(() => {
    ig.ENTITY.ElementPoleDest.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()

            ig.AnimatedEntity.prototype.update.call(this)
        },
    })
})
