import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import * as scActorEntity from './sc_ActorEntity-base'
import type { i16 } from 'ts-binarifier/src/type-aliases'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface NPC extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.NPC': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.NPC, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        config: memory.diff(Object.values(this.configs).indexOf(this.defaultConfig) as i16),
        activeStateIdx: memory.diff(this.activeStateIdx as i16),

        ...scActorEntity.getState.call(this, memory),
    }
}

function setState(this: ig.ENTITY.NPC, state: Return) {
    if (state.config !== undefined) {
        const config = Object.values(this.configs)[state.config]
        this.setDefaultConfig(config)
    }
    // let h = this.eventBlocked || (this.currentAction && this.currentAction.eventAction && !this._hidden)
    // init && (h = false)
    let h = false

    if (state.activeStateIdx !== undefined) {
        this.activeStateIdx = state.activeStateIdx
        if (this.activeStateIdx == -1) {
            sc.mapInteract.removeEntry(this.interactEntry)
        } else {
            const newState = this.npcStates[this.activeStateIdx]
            this.setMapInteractIcon(newState)
            if (h || !newState.npcEventObj) {
                sc.mapInteract.removeEntry(this.interactEntry)
            } else {
                sc.mapInteract.addEntry(this.interactEntry)
            }
        }
    }

    scActorEntity.setState.call(this, state)
}

prestart(() => {
    ig.ENTITY.NPC.inject({
        getState,
        setState,
    })
    ig.ENTITY.NPC.create = () => {
        throw new Error('ig.ENTITY.NPC.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.NPC, isStatic: true })

    if (REMOTE) {
        ig.ENTITY.NPC.inject({
            updateNpcState(init, force) {
                if (!isRemote(multi.server)) return this.parent(init, force)
            },
        })
    }
}, 2)
