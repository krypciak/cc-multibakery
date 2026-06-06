export function packetDeepEqual(a: any, b: any, map = new WeakMap(), path = '') {
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
    if (a === null && b === 0) return true
    if (a === null && b === false) return true

    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        console.warn('packet decode mismatch at', path, 'different types', 'a:', a, 'b:', b)
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
        console.warn('packet decode mismatch at', path, 'different keys length', 'a:', a, 'b:', b)
        debugger
        return false
    }

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i] as string
        if (!Reflect.has(b, key) || !packetDeepEqual(a[key], b[key], map, path + '.' + key)) {
            console.warn('packet decode mismatch at', path, 'a:', JSON.stringify(a), 'b:', JSON.stringify(b))
            debugger
            return false
        }
    }

    return true
}
