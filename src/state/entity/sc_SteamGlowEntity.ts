import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '.././state-util'
import type { StateKey } from '.././map-state-handlers'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'

declare global {
    namespace sc {
        interface SteamGlowEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.SteamGlowEntity': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: sc.SteamGlowEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.onlyOnce(this.coll.pos),
    }
}

function setEntityState(this: sc.SteamGlowEntity, _state: Return) {}

prestart(() => {
    sc.SteamGlowEntity.inject({
        getEntityState,
        setEntityState,
    })
    sc.SteamGlowEntity.create = (netid, state: Return) => {
        const settings: sc.SteamGlowEntity.Settings = {
            netid,
        }
        const { x, y, z } = state.pos!
        const entity = ig.game.spawnEntity(sc.SteamGlowEntity, x, y, z, settings)
        return entity
    }
    registerNetEntity({ entityClass: sc.SteamGlowEntity, temporary: true })
}, 2)

prestart(() => {
    sc.SteamGlowEntity.inject({ stop: universalPlayerEntityFix() })
})
