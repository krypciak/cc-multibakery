import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import type { StateKey } from '../states'
import { StateMemory } from '../state-util'
import * as scPlayerBaseEntity from './sc_PlayerBaseEntity-base'
import { assert } from '../../misc/assert'

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
        assert(state.modelName)
        assert(state.multiParty)
        const party = multi.server.party.parties[state.multiParty]
        assert(party)

        const entity = ig.game.spawnEntity(sc.PartyMemberEntity, 0, 0, 0, {
            netid,
            partyMemberName: state.modelName,
        })
        entity.multiParty = party
        return entity
    }
    registerNetEntity({ entityClass: sc.PartyMemberEntity })
}, 2)
