import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.ENTITY {
        interface Enemy extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Enemy': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Enemy, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igEntityCombatant.getState.call(this, memory),

        enemyType: memory.onlyOnce(this.enemyName),
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
    ig.ENTITY.Enemy.create = (netid: string, state: Return) => {
        assert(state.enemyType)

        const settings: ig.ENTITY.Enemy.Settings = {
            enemyInfo: {
                type: state.enemyType,
            },
            netid,
        }

        const enemy = ig.game.spawnEntity(ig.ENTITY.Enemy, 0, 0, 0, settings)
        return enemy
    }
    registerNetEntity({ entityClass: ig.ENTITY.Enemy, typeId, netidStatic: true })

    if (!REMOTE) return

    ig.ENTITY.Enemy.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
