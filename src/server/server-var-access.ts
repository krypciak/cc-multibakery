import { runTaskInMapInst, type Client } from '../client/client'
import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'
import { isRemote } from './remote/is-remote-server'

class MultiVarAccessor implements ig.Vars.Accessor {
    onVarAccess(_path: string, keys: string[]): ig.VarValue | void {
        assert(keys[0] == 'multi')

        if (keys[1] == 'active') return true

        if (isRemote(multi.server)) {
            console.warn(`multi.* will return incorrect data on remote!`)
        }

        if (keys[1].startsWith('players')) {
            let onMap = false
            if (keys[1].endsWith('OnMap')) {
                onMap = true
                keys[1] = keys[1].slice(0, -'OnMap'.length)
            }
            const clients: Client[] = onMap
                ? runTaskInMapInst(() => ig.ccmap!.clients)
                : [...multi.server.clients.values()]
            const playerModels: ig.Vars.Accessor[] = clients.map(c => c.dummy?.model).filter(Boolean)
            return ig.Vars.arrayVarAccess(playerModels, keys.slice(2))
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
