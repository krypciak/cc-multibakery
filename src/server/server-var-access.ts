import { runTaskInMapInst, type Client } from '../client/client'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { checkAndCutPrefix, checkAndCutSuffix } from '../misc/check-and-cut'
import { createPartyVarAccess } from '../pvp/pvp-var-access'
import { isRemote } from './remote/is-remote-server'

class MultiVarAccessor implements ig.Vars.Accessor {
    onVarAccess(_path: string, keys: string[]): ig.VarValue | void {
        assert(keys[0] == 'multi')

        if (keys[1] == 'active') return true

        if (isRemote(multi.server)) {
            console.warn(`multi.* will return incorrect data on remote!`)
        }

        if (checkAndCutPrefix(keys, 1, 'players')) {
            const onMap = checkAndCutSuffix(keys, 1, 'OnMap')
            const byName = checkAndCutSuffix(keys, 1, 'ByName')

            if (byName) {
                const name = keys[2]
                const client = multi.server.clients.get(name)
                if (!client) return
                const model = client.inst.sc.model.player
                return ig.Vars.forwardVar(model, keys, 3)
            } else {
                const clients: Client[] = onMap
                    ? runTaskInMapInst(() => ig.ccmap!.clients)
                    : [...multi.server.clients.values()]

                const playerModels = clients.map(c => c.dummy?.model).filter(Boolean)
                return ig.Vars.arrayVarAccess(playerModels, keys.slice(2))
            }
        }

        if (checkAndCutPrefix(keys, 1, 'parties')) {
            const byId = checkAndCutSuffix(keys, 1, 'ById')
            if (byId) {
                const id = keys[2]
                const party = multi.server.party.parties[id]
                if (!party) return
                const varAccess = createPartyVarAccess(party)
                return ig.Vars.forwardVar(varAccess, keys, 3)
            } else {
                return ig.Vars.arrayVarAccess(
                    Object.values(multi.server.party.parties).map(createPartyVarAccess),
                    keys.slice(2)
                )
            }
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
