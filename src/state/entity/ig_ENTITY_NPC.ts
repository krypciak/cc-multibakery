import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import * as scActorEntity from './sc_ActorEntity-base'
import { RemoteServer } from '../../server/remote/remote-server'
import { i16 } from 'ts-binarifier/src/type-aliases'

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

        ...scActorEntity.getState.call(this, memory),
    }
}

function setState(this: ig.ENTITY.NPC, state: Return) {
    if (state.config !== undefined) {
        const config = Object.values(this.configs)[state.config]
        this.setDefaultConfig(config)
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
                if (!(multi.server instanceof RemoteServer)) return this.parent(init, force)
            },
        })
    }
}, 2)
