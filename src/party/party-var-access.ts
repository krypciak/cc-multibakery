import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { arrayVarAccess } from '../steps/array/array'
import type { MultiParty } from './party'

export function multiPartyVarAccess(path: string, keys: string[], party?: MultiParty) {
    if (!party || !keys[0]) return

    if (keys[0] == 'id') return party.id
    if (keys[0] == 'owner') {
        const client = multi.server.clients.get(party.owner)
        assert(client?.dummy)
        return ig.vars.forwardEntityVarAccess(client.dummy, keys, 1)
    }
    if (keys[0] == 'combatantParty') return party.combatantParty
    if (keys[0] == 'title') return party.title

    if (keys[0] == 'combatants') {
        let onMap = false
        if (keys[1] == 'onMap') {
            onMap = true
            keys.splice(1, 1)
        }
        let combatants = multi.server.party.getPartyCombatants(party, onMap ? ig.game.mapName : undefined)
        if (keys[1] == 'all') {
        } else if (keys[1] == 'players') combatants = combatants.filter(c => c instanceof dummy.DummyPlayer)
        else if (keys[1] == 'vanillaMembers') combatants = combatants.filter(c => c instanceof sc.PartyMemberEntity)
        else throw new Error(`Invalid var access! ${path}`)

        return arrayVarAccess(combatants, keys.slice(2))
    }

    /* vanilla keys */
    if (keys[0] == 'has') {
        // return sc.party.currentParty.includes(keys[2])
        return party.vanillaMembers.includes(keys[1])
    } else if (keys[0] == 'alive') {
        const { entity } = multi.server.party.getVanillaMemberEntity(party, keys[1])
        return (
            !sc.party.dungeonBlocked &&
            // sc.party.currentParty.includes(keys[2]) &&
            // sc.party.getPartyMemberModel(keys[2]).isAlive()
            entity?.model.isAlive()
        )
    } else if (keys[0] == 'size') {
        return multi.server.party.vanillaSizeOf(party)
    }

    throw new Error(`Invalid var access! ${path}`)
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
                return multiPartyVarAccess(path, keys.slice(2), multi.server.party.getPartyOfEntity(this))
            return this.parent(path, keys)
        },
    })
})
prestart(() => {
    sc.PartyModel.inject({
        onVarAccess(path, keys) {
            if (!multi.server) return this.parent(path, keys)
            return multiPartyVarAccess(path, keys.slice(1), multi.server.party.getPartyOfEntity(ig.game.playerEntity))
        },
    })
})
