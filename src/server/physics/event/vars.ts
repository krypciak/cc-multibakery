import { assert } from '../../../misc/assert'
import { addVarModifyListener } from '../../../misc/var-set-event'
import { prestart } from '../../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'

declare global {
    namespace ig {
        interface Vars {
            nextSetBy?: ig.Entity
            varsSetBy: Record</* var */ string, ig.Entity>
        }
    }
}

prestart(() => {
    ig.Vars.inject({
        init() {
            this.parent()
            this.varsSetBy = {}
        },
    })
})

addVarModifyListener(path => {
    if (ig.vars.nextSetBy) {
        ig.vars.varsSetBy[path] = ig.vars.nextSetBy
        ig.vars.nextSetBy = undefined
    }
})
export function setNextSetBy(entity: ig.Entity) {
    assert(!ig.vars.nextSetBy)
    assert(entity)
    ig.vars.nextSetBy = entity
}
export function unsetNextSetBy() {
    ig.vars.nextSetBy = undefined
}
export function findSetByEntityByVars(vars: string[]): ig.Entity | undefined {
    return ig.vars.varsSetBy[vars.find(varName => ig.vars.varsSetBy[varName]) ?? -1]
}

prestart(() => {
    ig.Vars.inject({
        _getAccessObject(...args) {
            if (!(ig.vars.nextSetBy instanceof dummy.DummyPlayer)) return this.parent(...args)
            const client = ig.vars.nextSetBy.getClient(true)
            if (!client) return this.parent(...args)
            return runTask(client.inst, () => ig.vars._getVariable(...args))
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
