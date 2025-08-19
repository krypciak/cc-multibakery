import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'

declare global {
    namespace ig.ENTITY {
        interface Enemy extends StateMemory.MapHolder<StateKey> {}
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Enemy, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igEntityCombatant.getState.call(this, memory),
    }
}

function setState(this: ig.ENTITY.Enemy, state: Return) {
    if (this.enemyType && !this.enemyTypeInitialized) this.enemyType.initEntity(this)

    igEntityCombatant.setState.call(this, state)
}

prestart(() => {
    const typeId: EntityTypeId = 'en'
    ig.ENTITY.Enemy.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Enemy.create = () => {
        throw new Error('ig.ENTITY.Enemy.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Enemy, typeId, netidStatic: true })

    if (!REMOTE) return

    ig.ENTITY.Enemy.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
