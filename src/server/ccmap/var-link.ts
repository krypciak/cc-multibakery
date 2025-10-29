import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { prestart } from '../../loading-stages'

declare global {
    namespace ig {
        interface Vars {
            linkedTo?: ig.Vars
        }
    }
}

prestart(() => {
    ig.Vars.inject({
        clear() {
            this.parent()
            if (this.linkedTo) {
                link(this, this.linkedTo)
            }
        },
    })
})
function link(to: ig.Vars, from: ig.Vars) {
    to.linkedTo = from
    to.storage.maps = from.storage.maps
    to.storage.plot = from.storage.plot ??= {}
}

export function linkVars(toInst: InstanceinatorInstance, fromInst: InstanceinatorInstance) {
    link(toInst.ig.vars, fromInst.ig.vars)
}
