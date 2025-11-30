import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import type { StateKey } from '../states'
import { StateMemory } from '../state-util'
import * as scPlayerBaseEntity from './sc_PlayerBaseEntity-base'

declare global {
    namespace sc {
        interface PartyMemberEntity extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'sc.PartyMemberEntity': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: sc.PartyMemberEntity, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        ...scPlayerBaseEntity.getState.call(this, memory),
    }
}

function setState(this: sc.PartyMemberEntity, state: Return) {
    scPlayerBaseEntity.setState.call(this, state)
}

prestart(() => {
    sc.PartyMemberEntity.inject({
        getState,
        setState,
    })
    sc.PartyMemberEntity.create = (netid: EntityNetid, state: Return) => {
        throw new Error('sc.PartyMemberEntity.create not implemented')
    }
    registerNetEntity({ entityClass: sc.PartyMemberEntity })
}, 2)
