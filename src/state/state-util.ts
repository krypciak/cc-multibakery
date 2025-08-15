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

type ArrayDiffEntry<V> = [number, V]
type ArrayDiff<V> =
    | {
          diff: ArrayDiffEntry<V>[]
      }
    | {
          full: V[]
      }

export class StateMemory {
    private i: number
    private data: unknown[]

    private constructor() {
        this.i = 0
        this.data = []
    }

    static getStateMemory<K extends object>(obj: { lastSent?: WeakMap<K, StateMemory> }, key: K): StateMemory {
        obj.lastSent ??= new WeakMap()
        const entry = obj.lastSent.get(key)
        if (entry) {
            entry.i = 0
            return entry
        }
        const memory = new StateMemory()
        if (key) obj.lastSent.set(key, memory)
        return memory
    }

    isEmpty(): boolean {
        return this.data.length == 0
    }

    isSameAsLast<V>(
        currValue: V,
        eq: (a: V, b: V) => boolean = (a, b) => a == b,
        clone: (a: V) => V = a => a
    ): V | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(clone(currValue))
            return currValue
        } else {
            const lastValue = this.data[i] as V

            const isEq = lastValue === undefined ? currValue === undefined : eq(lastValue, currValue)
            if (isEq) return undefined
            this.data[i] = clone(currValue)
            return currValue
        }
    }

    onlyOnce<V>(currValue: V): V | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(currValue)
            return currValue
        }
    }

    diffArray<V extends number | string | null | undefined>(currValue: V[]): ArrayDiff<V> | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push([...currValue])
            return { full: currValue }
        } else {
            const lastArr = this.data[i] as V[]

            assert(lastArr.length == currValue.length)

            const diff: ArrayDiffEntry<V>[] = []
            for (let i = 0; i < currValue.length; i++) {
                if (currValue[i] != lastArr[i]) {
                    diff.push([i, currValue[i]])
                }
            }
            if (diff.length == 0) return undefined
            this.data[i] = [...currValue]
            return { diff }
        }
    }

    static applyDiffArray<E, K extends keyof E, V>(obj: E, key: K, diff: ArrayDiff<V>) {
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
}
