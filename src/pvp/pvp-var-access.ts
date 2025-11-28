import { prestart } from '../loading-stages'
import { arrayVarAccess } from '../steps/array/array'

prestart(() => {
    sc.PvpModel.inject({
        // onVarAccess different team points??
        onVarAccess(path, keys) {
            if (!multi.server) return this.parent(path, keys)
            if (keys[0] == 'pvp') {
                if (keys[1] == 'parties') return arrayVarAccess(this.parties, keys.slice(2))
                if (keys[1] == 'players') {
                    return arrayVarAccess(
                        this.parties.flatMap(party =>
                            multi.server.party
                                .getPartyCombatants(party)
                                .filter(entity => entity instanceof dummy.DummyPlayer)
                        ),
                        keys.slice(2)
                    )
                }
                if (keys[1] == 'isPlayerInPvp') return sc.pvp.isCombatantInPvP(ig.game.playerEntity)
            }
            return this.parent(path, keys)
        },
    })
})
