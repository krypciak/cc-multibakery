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
                linkVars(this, this.linkedTo)
            }
        },
    })
})

export function linkVars(to: ig.Vars, from: ig.Vars) {
    to.linkedTo = from
    to.storage.maps = from.storage.maps
    to.storage.plot = from.storage.plot ??= {}
}
