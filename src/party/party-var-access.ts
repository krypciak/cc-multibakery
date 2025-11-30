import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { arrayVarAccess } from '../steps/array/array'
import type { MultiParty } from './party'

function multiPartyVarAccess(keys: string[], party?: MultiParty) {
    if (!party || !keys[0]) return

    if (keys[0] == 'id') return party.id
    if (keys[0] == 'owner') {
        const client = multi.server.clients.get(party.owner)
        assert(client?.dummy)
        return ig.vars.forwardEntityVarAccess(client.dummy, keys, 1)
    }
    if (keys[0] == 'combatantParty') return party.combatantParty
    if (keys[0] == 'title') return party.title
    if (keys[0].startsWith('players')) {
        return arrayVarAccess(
            multi.server.party
                .getPartyCombatants(party, keys[0].endsWith('OnMap') ? ig.game.mapName : undefined)
                .filter(c => c instanceof dummy.DummyPlayer),
            keys.slice(1)
        )
    }

    /* vanilla keys */
    if (keys[1] == 'has') {
        return sc.party.currentParty.includes(keys[2])
    } else if (keys[1] == 'alive') {
        return (
            !sc.party.dungeonBlocked &&
            sc.party.currentParty.includes(keys[2]) &&
            sc.party.getPartyMemberModel(keys[2]).isAlive()
        )
    } else if (keys[1] == 'size') {
        return sc.party.currentParty.length + 1
    }
}

prestart(() => {
    ig.ENTITY.Combatant.inject({
        onVarAccess(path, keys) {
            if (multi.server && keys[1] == 'combatantParty') return this.party
            return this.parent(path, keys)
        },
    })
    sc.PlayerBaseEntity.inject({
        onVarAccess(path, keys) {
            if (multi.server && keys[1] == 'multiParty')
                return multiPartyVarAccess(keys.slice(2), multi.server.party.getPartyOfEntity(this))
            return this.parent(path, keys)
        },
    })
})
prestart(() => {
    sc.PartyModel.inject({
        onVarAccess(path, keys) {
            if (!multi.server) return this.parent(path, keys)
            return multiPartyVarAccess(keys.slice(1), multi.server.party.getPartyOfEntity(ig.game.playerEntity))
        },
    })
})
