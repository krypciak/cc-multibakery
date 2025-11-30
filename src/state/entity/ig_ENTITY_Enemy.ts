import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as igEntityCombatant from './ig_ENTITY_Combatant-base'
import { assert } from '../../misc/assert'
import { isRemote } from '../../server/remote/is-remote-server'

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
    ig.ENTITY.Enemy.inject({
        getState,
        setState,
    })
    ig.ENTITY.Enemy.create = (netid: EntityNetid, state: Return) => {
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
    registerNetEntity({ entityClass: ig.ENTITY.Enemy, isStatic: true })

    if (!REMOTE) return

    ig.ENTITY.Enemy.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })

    sc.EnemyType.inject({
        initEntity(enemy) {
            if (!isRemote(multi.server)) return this.parent(enemy)
            this.attribs = {}
            return this.parent(enemy)
        },
    })
}, 2)
