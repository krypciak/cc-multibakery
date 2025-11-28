import { prestart } from '../loading-stages'
import { MultiParty } from './party'

function multiPartyVarAccess(keys: string[], party?: MultiParty) {
    if (!party) return

    if (keys[0] == 'id') return party.id
    if (keys[0] == 'owner') return party.owner
    if (keys[0] == 'combatantParty') return party.combatantParty
    if (keys[0] == 'title') return party.title
    if (keys[0] == 'playerCount') return party.players.length
    if (keys[0] == 'playerCountOnMap') return multi.server.party.getPartyCombatants(party, true, ig.game.mapName).length
}

prestart(() => {
    ig.ENTITY.Combatant.inject({
        onVarAccess(path, keys) {
            if (keys[1] == 'combatantParty') return this.party
            return this.parent(path, keys)
        },
    })
    sc.PlayerBaseEntity.inject({
        onVarAccess(path, keys) {
            if (keys[1] == 'multiParty') return multiPartyVarAccess(keys.slice(2), this.multiParty)
            return this.parent(path, keys)
        },
    })
})
