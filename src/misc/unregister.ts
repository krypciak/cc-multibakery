import { prestart } from '../loading-stages'

declare global {
    namespace ig {
        interface Vars {
            unregisterVarAccessor(this: this, accessor: ig.Vars.Accessor): void
        }
    }
}
prestart(() => {
    ig.Vars.inject({
        unregisterVarAccessor(accessor) {
            this.varAccessors = this.varAccessors.filter(acc => acc.accessor != accessor)
        },
    })
})

declare global {
    namespace ig {
        interface Storage {
            unregister(this: this, listener: ig.Storage.Listener): void
        }
    }
}
prestart(() => {
    ig.Storage.inject({
        unregister(listener) {
            this.listeners.erase(listener)
        },
    })
})
