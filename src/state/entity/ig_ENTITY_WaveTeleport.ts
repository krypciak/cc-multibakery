import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'

declare global {
    namespace ig.ENTITY {
        interface WaveTeleport extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WaveTeleport': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.WaveTeleport, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.WaveTeleport, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.WaveTeleport.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.WaveTeleport.create = () => {
        throw new Error('ig.ENTITY.WaveTeleport.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.WaveTeleport })
}, 2)

prestart(() => {
    ig.ENTITY.WaveTeleport.inject({ ballHit: universalPlayerEntityFix(ballLike => [ballLike.getCombatantRoot()]) })
})
