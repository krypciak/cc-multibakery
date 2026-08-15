import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface SteamTurnout extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.SteamTurnout': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.SteamTurnout, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.SteamTurnout, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.SteamTurnout.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.SteamTurnout.create = () => {
        throw new Error('ig.ENTITY.SteamTurnout.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.SteamTurnout })
}, 2)
