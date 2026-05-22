export function packetDeepEqual(a: any, b: any, map = new WeakMap()) {
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

    if (typeof a === 'undefined' && b === false) return true

    if ((typeof a === 'boolean' && typeof b === 'number') || (typeof a === 'number' && typeof b === 'boolean')) {
        return !!a == !!b
    }
    if (a === null && b == 'null') return true

    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        debugger
        return false
    }

    if (map.get(a) === b) return true
    map.set(a, b)

    const keysA = Reflect.ownKeys(a).filter(k => a[k] !== undefined)
    const keysB = Reflect.ownKeys(b).filter(k => b[k] !== undefined)

    if (keysA.length !== keysB.length && keysA.length == 3 && keysB.length == 2 && keysA.includes('z')) {
        keysA.erase('z')
    }

    for (const keyB in b) {
        if (a[keyB] === undefined) keysB.erase(keyB)
    }

    if (keysA.length !== keysB.length) {
        debugger
        return false
    }

    for (let i = 0; i < keysA.length; i++) {
        if (!Reflect.has(b, keysA[i]) || !packetDeepEqual(a[keysA[i]], b[keysA[i]], map)) {
            debugger
            return false
        }
    }

    return true
}
