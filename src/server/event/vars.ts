import { assert } from '../../misc/assert'
import { addVarModifyListener } from '../../misc/var-set-event'
import { prestart } from '../../plugin'

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
    const varInst = instanceinator.instances[ig.vars._instanceId]
    if (varInst) varInst.ig.game._deferredVarChanged = ig.game._deferredVarChanged
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
