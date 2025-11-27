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
