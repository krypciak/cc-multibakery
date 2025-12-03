import { prestart } from '../../loading-stages'

export function forwardVarAccess(obj: ig.Vars.Accessor, keys: string[]) {
    if (!obj) return null
    if (keys.length == 0) return obj
    if (obj.onVarAccess) {
        let newPath = keys[0] ?? ''
        for (let i = 1; i < keys.length; i++) {
            newPath += '.' + keys[i]
        }
        return obj.onVarAccess(newPath, keys)
    }
    return null
}

export function attemptForwardVar(value: unknown, keys: string[], keysOffset: number) {
    if (value && typeof value === 'object') {
        if (value instanceof ig.Entity) {
            return ig.vars.forwardEntityVarAccess(value, keys, keysOffset)
        } else if ('onVarAccess' in value && typeof value.onVarAccess === 'function') {
            return forwardVarAccess(value as ig.Vars.Accessor, keys.slice(keysOffset))
        }
    }
}

let fromResolve = false
prestart(() => {
    ig.Vars.inject({
        _get(path) {
            if (path) {
                const keys = path.split('.')
                var obj = this.storage
                for (let i = 0; i < keys.length; i++) {
                    const v = obj[keys[i]]
                    if (!v || typeof v != 'object') break
                    obj = v

                    const forwardValue = attemptForwardVar(obj, keys, i + 1)
                    if (forwardValue) return forwardValue
                }
            }

            const ret = this.parent(path)
            if (fromResolve && typeof ret === 'number') return ret.toString()
            return ret
        },
    })
})

prestart(() => {
    const orig = ig.VarPathResolver.resolve
    ig.VarPathResolver.resolve = function (this: ig.VarPathResolver, path: string) {
        fromResolve = true
        const ret = orig.call(this, path)
        fromResolve = false
        return ret
    }
})
