import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace sc {
        interface IceDiskEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.IceDiskEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.IceDiskEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.IceDiskEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.IceDiskEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.IceDiskEntity.create = (netid, state: Return) => {
        const settings: sc.IceDiskEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.IceDiskEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.IceDiskEntity })
}, 2)
