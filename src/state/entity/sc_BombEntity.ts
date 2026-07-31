import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'
import { assert } from '../../misc/assert'

declare global {
    namespace sc {
        interface BombEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.BombEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.BombEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        panel: memory.onlyOnce(this.panel?.netid),
    }
}

function setEntityState(this: sc.BombEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

prestart(() => {
    sc.BombEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.BombEntity.create = (netid, state: Return) => {
        const panel = state.panel ? ig.game.entitiesByNetid[state.panel] : undefined
        if (panel) assert(panel instanceof ig.ENTITY.BombPanel)
        if (panel?.bomb) panel.bomb.kill(true)

        const settings: sc.BombEntity.Settings = { netid, panel }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.BombEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.BombEntity })
}, 2)

prestart(() => {
    sc.BombEntity.inject({
        ballHit: universalPlayerEntityFix(ballLike => [ballLike.getCombatantRoot()]),
        explode: universalPlayerEntityFix(function () {
            return [this.combatant]
        }),
    })
})
