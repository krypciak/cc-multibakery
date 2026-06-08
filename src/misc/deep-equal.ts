export function deepEqual(a: any, b: any, map = new WeakMap()) {
    if (Object.is(a, b)) return true

    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
    }
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.toString() === b.toString()
    }

    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.001) {
        return true
    }

    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false
    }

    if (map.get(a) === b) return true
    map.set(a, b)

    const keysA = Reflect.ownKeys(a).filter(k => a[k] !== undefined)
    const keysB = Reflect.ownKeys(b).filter(k => b[k] !== undefined)

    if (keysA.length !== keysB.length) {
        return false
    }

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i] as string
        if (!Reflect.has(b, key) || !deepEqual(a[key], b[key], map)) {
            return false
        }
    }

    return true
}
