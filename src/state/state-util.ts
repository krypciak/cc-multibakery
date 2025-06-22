import { assert } from '../misc/assert'

export function undefinedIfFalsy<T>(obj: T): T | undefined {
    return obj ? obj : undefined
}
export function undefinedIfVec2Zero(vec: Vec2): Vec2 | undefined {
    return Vec2.isZero(vec) ? undefined : vec
}
export function undefinedIfVec3Zero(vec: Vec3): Vec3 | undefined {
    return Vec3.isZero(vec) ? undefined : vec
}
export function isSameAsLast<V>(
    entity: ig.Entity,
    full: boolean,
    currValue: V,
    key: string,
    eq: (a: V, b: V) => boolean = (a, b) => a == b,
    clone: (a: V) => V = a => a
): V | undefined {
    // @ts-expect-error
    const lastSent = (entity.lastSent ??= {})
    const lastValue = lastSent[key]

    const isEq = lastValue === undefined ? currValue === undefined : eq(lastValue, currValue)
    if (!full && isEq) return undefined
    lastSent[key] = clone(currValue)
    return currValue
}

type ArrayDiffEntry<V> = [number, V]
type ArrayDiff<V> =
    | {
          diff: ArrayDiffEntry<V>[]
      }
    | {
          full: V[]
      }
export function diffArray<V extends number | string | null | undefined>(
    entity: ig.Entity,
    full: boolean,
    currArr: V[],
    key: string
): ArrayDiff<V> | undefined {
    // @ts-expect-error
    const lastSent = (entity.lastSent ??= {})
    const lastArr: V[] = lastSent[key]

    if (full || !lastArr) {
        lastSent[key] = [...currArr]
        return { full: currArr }
    }
    assert(lastArr.length == currArr.length)

    const diff: ArrayDiffEntry<V>[] = []
    for (let i = 0; i < currArr.length; i++) {
        if (currArr[i] != lastArr[i]) {
            diff.push([i, currArr[i]])
        }
    }
    if (diff.length == 0) return undefined
    lastSent[key] = [...currArr]
    return { diff }
}
export function applyDiffArray<E, K extends keyof E, V>(obj: E, key: K, diff: ArrayDiff<V>) {
    if ('full' in diff) {
        // @ts-expect-error
        obj[key] = diff.full
    } else {
        for (const [i, v] of diff.diff) {
            // @ts-expect-error
            obj[key][i] = v
        }
    }
}
