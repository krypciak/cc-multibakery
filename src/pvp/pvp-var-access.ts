import { prestart } from '../loading-stages'
import { multiPartyVarAccess } from '../party/party-var-access'

prestart(() => {
    sc.PvpModel.inject({
        // onVarAccess different team points??
        onVarAccess(path, keys) {
            if (multi.server && keys[0] == 'pvp') {
                if (keys[1] == 'parties')
                    return ig.Vars.arrayVarAccess(
                        this.parties.map(party => ({
                            onVarAccess: (path: string, keys: string[]) => multiPartyVarAccess(path, keys, party),
                        })),
                        keys.slice(2)
                    )
                if (keys[1] == 'players') {
                    return ig.Vars.arrayVarAccess(
                        this.parties.flatMap(party =>
                            multi.server.party
                                .getPartyCombatants(party)
                                .filter(entity => entity instanceof dummy.DummyPlayer)
                        ),
                        keys.slice(2)
                    )
                }
                if (keys[1] == 'isPlayerInPvp') return sc.pvp.isCombatantInPvP(ig.game.playerEntity)
                if (keys[1] == 'active' && this.multiplayerPvp) return true
            }
            return this.parent(path, keys)
        },
    })
})
