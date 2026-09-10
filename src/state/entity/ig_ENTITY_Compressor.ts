import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'

declare global {
    namespace ig.ENTITY {
        interface Compressor extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Compressor': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.Compressor, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.Compressor, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.Compressor.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.Compressor.create = () => {
        throw new Error('ig.ENTITY.Compressor.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Compressor })
}, 2)

prestart(() => {
    ig.ENTITY.Compressor.inject({
        ballHit: universalPlayerEntityFix(ballLike => [ballLike.getCombatantRoot()]),
    })
})
