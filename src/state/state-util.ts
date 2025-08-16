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

export function cleanRecord<T extends object>(rec: T): T | undefined {
    const newRecord: Record<string, unknown> = {}
    let atLeastOneKey = false
    for (const key in rec) {
        const value = rec[key]
        if (value || value === false) {
            newRecord[key] = value
            atLeastOneKey = true
        }
    }
    if (!atLeastOneKey) return undefined

    return newRecord as T
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

    static getBy<K extends object>(obj: { lastSent?: WeakMap<K, StateMemory> }, key: K | undefined): StateMemory {
        obj.lastSent ??= new WeakMap()
        if (key) {
            const entry = obj.lastSent.get(key)
            if (entry) {
                entry.i = 0
                return entry
            }
        }
        const memory = new StateMemory()
        if (key) obj.lastSent.set(key, memory)
        return memory
    }

    static get(memory?: StateMemory) {
        if (!memory) return new StateMemory()
        memory.i = 0
        return memory
    }

    isEmpty(): boolean {
        return this.data.length == 0
    }

    diff<V>(currValue: V, eq: (a: V, b: V) => boolean = (a, b) => a == b, clone: (a: V) => V = a => a): V | undefined {
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

    diffRecord<K extends string, V>(currRecord: PartialRecord<K, V>): PartialRecord<K, V> | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(currRecord)
            return currRecord
        } else {
            const lastRecord = this.data[i] as Record<K, V>
            const changed: PartialRecord<K, V> = {}
            let atLeastOne = false

            for (const key in currRecord) {
                const currValue = currRecord[key]
                const lastValue = lastRecord[key]

                if (currValue != lastValue) {
                    changed[key] = currValue
                    atLeastOne = true
                }
            }
            this.data[i] = { ...currRecord }

            return atLeastOne ? changed : undefined
        }
    }

    static applyChangeRecord<K extends string, V>(into: PartialRecord<K, V>, change: PartialRecord<K, V> | undefined) {
        if (!change) return

        Object.assign(into, change)
    }

    diffStaticArray<V extends number | string | null | undefined>(currValue: V[]): ArrayDiff<V> | undefined {
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

    static applyDiffStaticArray<E, K extends keyof E, V>(obj: E, key: K, diff: ArrayDiff<V> | undefined) {
        if (!diff) return

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

    diffArray<V>(arr: V[]) {
        return this.diff(
            arr,
            (a, b) => a.length == b.length && a.every((v, i) => v == b[i]),
            arr => [...arr]
        )
    }

    diffVec2(vec: Vec2) {
        return this.diff(vec, Vec2.equal, Vec2.create)
    }

    diffVec3(vec: Vec3) {
        return this.diff(vec, Vec3.equal, Vec3.create)
    }
}
