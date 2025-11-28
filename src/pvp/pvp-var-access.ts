import { prestart } from '../loading-stages'

prestart(() => {
    sc.PvpModel.inject({
        // onVarAccess different team points??
        onVarAccess(path, keys) {
            if (!multi.server) return this.parent(path, keys)
            if (keys[0] == 'pvp') {
                if (keys[1] == 'partyCount') return this.parties.length
                if (keys[1] == 'isPlayerInPvp') return sc.pvp.isCombatantInPvP(ig.game.playerEntity)
            }
            return this.parent(path, keys)
        },
    })
})
