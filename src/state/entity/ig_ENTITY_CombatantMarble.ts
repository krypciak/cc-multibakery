import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateKey } from '../states'
import { createFakeEffectSheet } from '../entity'
import { StateMemory } from '../state-util'

declare global {
    namespace ig.ENTITY {
        interface CombatantMarble extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.CombatantMarble': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.CombatantMarble, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        pos: memory.diffVec3(this.coll.pos),
    }
}

function setState(this: ig.ENTITY.CombatantMarble, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)
    this.updateAnim()
}

prestart(() => {
    const typeId: EntityTypeId = 'cm'
    let counter = 0
    ig.ENTITY.CombatantMarble.inject({
        getState,
        setState,
        createNetid() {
            return `${typeId}${counter++}`
        },
    })
    ig.ENTITY.CombatantMarble.create = (netid, state: Return) => {
        const settings: ig.ENTITY.CombatantMarble.Settings = {
            target: { coll: { pos: { z: 0 } }, getCenter: () => Vec3.create() } as any,
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(ig.ENTITY.CombatantMarble, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: ig.ENTITY.CombatantMarble, typeId })

    if (!REMOTE) return

    ig.ENTITY.CombatantMarble.inject({
        init(x, y, z, settings) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(x, y, z, settings)

            this.effects = createFakeEffectSheet()
            this.parent(x, y, z, settings)
        },
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
