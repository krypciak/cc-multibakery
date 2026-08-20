import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'

declare global {
    namespace ig.ENTITY {
        interface SteamPipe extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.SteamPipe': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.SteamPipe, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        duration: memory.diff(this.steam.duration),
        startTimer: memory.diff(this.steam.startTimer),
        endTimer: memory.diff(this.steam.endTimer),
        startPoint: memory.diff(this.steam.startPoint),
    }
}

function setEntityState(this: ig.ENTITY.SteamPipe, state: Return) {
    if (state.duration !== undefined) this.steam.duration = state.duration
    if (state.startTimer !== undefined) this.steam.startTimer = state.startTimer
    if (state.endTimer !== undefined) this.steam.endTimer = state.endTimer
    if (state.startPoint !== undefined) this.steam.startPoint = state.startPoint
}

prestart(() => {
    ig.ENTITY.SteamPipe.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.SteamPipe.create = () => {
        throw new Error('ig.ENTITY.SteamPipe.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.SteamPipe })
}, 2)
