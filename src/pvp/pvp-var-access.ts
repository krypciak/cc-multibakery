import { prestart } from '../loading-stages'
import type { MultiParty } from '../party/party'
import { multiPartyVarAccess } from '../party/party-var-access'

export function createPartyVarAccess(party: MultiParty) {
    return {
        onVarAccess: (path: string, keys: string[]) => multiPartyVarAccess(path, keys, party),
    }
}

prestart(() => {
    sc.PvpModel.inject({
        // onVarAccess different team points??
        onVarAccess(path, keys) {
            if (keys[0] == 'pvp') {
                if (keys[1] == 'multiActive') return this.multiplayerPvp
                if (keys[1] == 'active' && this.multiplayerPvp) return false

                if (multi.server) {
                    if (keys[1] == 'parties') {
                        return ig.Vars.arrayVarAccess(this.parties.map(createPartyVarAccess), keys.slice(2))
                    }
                    if (keys[1] == 'players') {
                        return ig.Vars.arrayVarAccess(
                            this.parties.flatMap(party =>
                                multi.server.party
                                    .getPartyCombatants(party, ig.game.mapName)
                                    .filter(entity => entity instanceof dummy.DummyPlayer)
                            ),
                            keys.slice(2)
                        )
                    }
                    if (keys[1] == 'points') {
                        const partyId = keys[2]
                        const party = multi.server.party.parties[partyId]
                        if (!party) return
                        return this.points[party.combatantParty]
                    }
                    if (keys[1] == 'lastWinPartyId') {
                        return sc.pvp.lastWinPartyId
                    }
                }
            }
            return this.parent(path, keys)
        },
    })
})
