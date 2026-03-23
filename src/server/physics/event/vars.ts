import { assert } from '../../../misc/assert'
import { addVarModifyListener } from '../../../misc/var-set-event'
import { prestart } from '../../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'

declare global {
    namespace ig {
        interface Vars {
            nextSetBy: ig.Entity[]
            varsSetBy: Record</* var */ string, ig.Entity>
        }
    }
}

prestart(() => {
    ig.Vars.inject({
        init() {
            this.parent()
            this.varsSetBy = {}
            this.nextSetBy = []
        },
    })
})

addVarModifyListener(path => {
    if (ig.vars.nextSetBy.length > 0) {
        ig.vars.varsSetBy[path] = ig.vars.nextSetBy.last()
        ig.vars.nextSetBy.pop()
    }
})
export function setNextSetBy(entity: ig.Entity) {
    assert(entity)
    ig.vars.nextSetBy.push(entity)
}
export function unsetNextSetBy() {
    ig.vars.nextSetBy.pop()
}
export function findSetByEntityByVars(vars: string[]): ig.Entity | undefined {
    return ig.vars.varsSetBy[vars.find(varName => ig.vars.varsSetBy[varName]) ?? -1]
}

prestart(() => {
    ig.Vars.inject({
        _getAccessObject(path) {
            let player: dummy.DummyPlayer | undefined
            for (let i = ig.vars.nextSetBy.length - 1; i >= 0; i--) {
                const entity = ig.vars.nextSetBy[i]
                if (entity instanceof dummy.DummyPlayer) {
                    player = entity
                    break
                }
            }
            if (!player) return this.parent(path)
            const client = player.getClient(true)
            if (!client) return this.parent(path)

            return runTask(client.inst, () => {
                const newPath = ig.VarPathResolver.resolve(path)
                if (!newPath) return null
                return ig.vars._getVariable(newPath, true)
            })
        },
    })
})

prestart(() => {
    ig.Game.inject({
        varsChangedDeferred() {
            this.parent()
            if (!ig.ccmap) return
            for (const inst of ig.ccmap.getAllInstances()) inst.ig.game._deferredVarChanged = true
        },
    })
})

prestart(() => {
    ig.Game.inject({
        varsChangedDeferred() {
            this.parent()
            if (!ig.client) return
            const map = ig.client.getMap(true)
            if (!map) return
            for (const inst of map.getAllInstances(true)) inst.ig.game._deferredVarChanged = true
        },
    })
})
