import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'

declare global {
    namespace sc {
        interface CompressedWaveEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.CompressedWaveEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.CompressedWaveEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: sc.CompressedWaveEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.CompressedWaveEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.CompressedWaveEntity.create = (netid, state: Return) => {
        const settings: sc.CompressedWaveEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.CompressedWaveEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.CompressedWaveEntity, temporary: true })
}, 2)

prestart(() => {
    sc.CompressedBaseEntity.inject({
        onKill: universalPlayerEntityFix(function () {
            return [this.combatant]
        }),
    })
})
