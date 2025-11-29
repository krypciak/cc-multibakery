import { prestart } from '../loading-stages'

prestart(() => {
    ig.Vars.inject({
        resolveObjectAccess(object, keys, keysOffset) {
            if (keys.length == keysOffset) return object
            return this.parent(object, keys, keysOffset)
        },
    })
})
