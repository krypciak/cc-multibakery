import { registerNetEntity, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'

declare global {
    namespace ig.ENTITY {
        interface TeslaCoil extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.TeslaCoil': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.TeslaCoil, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}
function setEntityState(this: ig.ENTITY.TeslaCoil, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.TeslaCoil.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.TeslaCoil.create = () => {
        throw new Error('ig.ENTITY.TeslaCoil.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.TeslaCoil })
}

declare global {
    namespace ig.ENTITY {
        interface TeslaCoil {
            lastInteractPlayerNetid?: EntityNetid
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.TeslaCoil.inject({
        discharge: universalPlayerEntityFix(function (_entities) {
            return [ig.game.entitiesByNetid[this.lastInteractPlayerNetid ?? -1]]
        }),
        ballHit(ballLike, blockDir) {
            this.lastInteractPlayerNetid = ig.game.playerEntity?.netid
            return this.parent(ballLike, blockDir)
        },
    })
})
