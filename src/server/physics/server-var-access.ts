import { runTaskInMapInst } from '../../client/client'
import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { isRemote } from '../remote/is-remote-server'

class MultiVarAccessor implements ig.Vars.Accessor {
    onVarAccess(_path: string, keys: string[]): ig.VarValue | void {
        assert(keys[0] == 'multi')

        /* multi.active - always true when server is on */
        if (keys[1] == 'active') return true

        if (isRemote(multi.server)) {
            console.warn('var access multi.* will return incorrect data on remote!')
        }

        /* multi.playerCount - returns the player count (all maps) */
        if (keys[1] == 'playerCount') return multi.server.clients.size

        /* multi.playerCountOnMap - returns the player count (only the current map) */
        if (keys[1] == 'playerCountOnMap') {
            if (instanceinator.id == multi.server.inst.id) return 0
            return runTaskInMapInst(() => ig.ccmap!.clients.length)
        }
    }
}

prestart(() => {
    const multiVarAccessor = new MultiVarAccessor()
    ig.Vars.inject({
        init() {
            this.parent()
            if (!multi.server) return

            this.registerVarAccessor('multi', multiVarAccessor)
        },
    })
})
