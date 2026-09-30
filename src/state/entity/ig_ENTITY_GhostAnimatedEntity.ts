import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.ENTITY {
        namespace GhostAnimatedEntity {
            interface Settings extends ig.AnimatedEntity.Settings {
                size: Vec3
            }
        }
        interface GhostAnimatedEntity extends ig.AnimatedEntity {}
        interface ARBoxEntityConstructor extends ImpactClass<GhostAnimatedEntity> {
            new (x: number, y: number, z: number, settings: ig.ENTITY.GhostAnimatedEntity.Settings): GhostAnimatedEntity
        }
        var GhostAnimatedEntity: ARBoxEntityConstructor
    }
}
prestart(() => {
    ig.ENTITY.GhostAnimatedEntity = ig.AnimatedEntity.extend({
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)

            this.coll.setType(ig.COLLTYPE.NONE)
            this.setSize(settings.size.x, settings.size.y, settings.size.z)
        },
    })
})

declare global {
    namespace ig.ENTITY {
        interface GhostAnimatedEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.GhostAnimatedEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.GhostAnimatedEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        size: memory.diffVec3(this.coll.size),
    }
}

function setEntityState(this: ig.ENTITY.GhostAnimatedEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    ig.ENTITY.GhostAnimatedEntity.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.GhostAnimatedEntity.create = (netid, state: Return) => {
        assert(state.pos)
        assert(state.size)

        const { x, y, z } = state.pos
        const entity = ig.game.spawnEntity('GhostAnimatedEntity', x, y, z, {
            netid,
            size: state.size,
        })
        return entity
    }
    registerNetEntity({ entityClass: ig.ENTITY.GhostAnimatedEntity })
})
