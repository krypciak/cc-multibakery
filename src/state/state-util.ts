import { PhysicsServer } from '../server/physics/physics-server'

export function shouldCollectStateData(): boolean {
    return multi.server instanceof PhysicsServer && multi.server.anyRemoteClientsOn
}

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
        if (value !== undefined && value !== null) {
            newRecord[key] = value
            atLeastOneKey = true
        }
    }
    if (!atLeastOneKey) return undefined

    return newRecord as T
}

export namespace StateMemory {
    export type ArrayDiffEntry<V> = [number, V]
    export type ArrayDiff<V> =
        | {
              diff: ArrayDiffEntry<V>[]
          }
        | {
              full: V[]
          }

    export interface MapHolder<K extends object> {
        lastSent?: WeakMap<K, StateMemory>
    }
}
export class StateMemory {
    private i: number = 0
    private data: unknown[] = []

    private constructor() {}

    static getBy<K extends object>(obj: StateMemory.MapHolder<K>, key: K | undefined): StateMemory {
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

    diffRecord<T extends object>(
        currRecord: T,
        eq: (a: T[keyof T], b: T[keyof T] | undefined) => boolean = (a, b) => a == b
    ): T | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(currRecord)
            return currRecord
        } else {
            const lastRecord = this.data[i] as T
            const changed = {} as T
            let atLeastOne = false

            const keys = (
                Array.isArray(currRecord) ? currRecord.keys() : Object.keys(currRecord).values()
            ) as ArrayIterator<keyof T>

            for (const key of keys) {
                const currValue = currRecord[key]
                const lastValue = lastRecord[key]

                if (!eq(currValue, lastValue)) {
                    changed[key] = currValue
                    atLeastOne = true
                }
            }
            this.data[i] = { ...currRecord }

            return atLeastOne ? changed : undefined
        }
    }

    diffRecord2Deep<T extends Record<string, Record<string, V>>, V>(
        currRecord: T,
        eq: (a: V, b: V) => boolean = (a, b) => a == b,
        clone: (a: V) => V = a => a
    ): T | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(currRecord)
            return currRecord
        } else {
            function cloneRecord(rec: Record<string, V>): Record<string, V> {
                return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, clone(v)]))
            }

            const lastRecord = this.data[i] as T
            const changed: Record<string, Record<string, V>> = {}
            let atLeastOne = false

            for (const key1 in currRecord) {
                const currSubR = currRecord[key1] as Record<string, V>
                const lastSubR = lastRecord[key1] as Record<string, V> | undefined

                if (!lastSubR) {
                    changed[key1] = cloneRecord(currSubR)
                    atLeastOne = true
                } else {
                    for (const key2 in currSubR) {
                        const currV = currSubR[key2]
                        const lastV = lastSubR[key2]
                        if (!eq(currV, lastV)) {
                            ;(changed[key1] ??= {})[key2] = clone(currV)
                            atLeastOne = true
                        }
                    }
                }
            }
            const newRecord: Record<string, Record<string, V>> = { ...currRecord }
            for (const key in newRecord) {
                newRecord[key] = cloneRecord(newRecord[key])
            }
            this.data[i] = newRecord

            return atLeastOne ? (changed as T) : undefined
        }
    }

    static applyChangeRecord<T extends object>(into: NoInfer<T>, change: T | undefined) {
        if (!change) return

        Object.assign(into, change)
    }

    diffArray<V>(arr: V[], eq: (a: V, b: V) => boolean = (a, b) => a == b) {
        return this.diff(
            arr,
            (a, b) => a.length == b.length && a.every((v, i) => eq(v, b[i])),
            arr => [...arr]
        )
    }

    diffVec2(vec: Vec2) {
        return this.diff(vec, Vec2.equal, Vec2.create)
    }

    diffVec3(vec: Vec3) {
        return this.diff(vec, Vec3.equal, Vec3.create)
    }

    diffGrowingSet<V>(currSet: Set<V>) {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(new Set(currSet))
            return [...currSet]
        } else {
            const lastSet = this.data[i] as Set<V>

            const newValues: V[] = []
            for (const currValue of currSet) {
                if (!lastSet.has(currValue)) {
                    newValues.push(currValue)
                }
            }

            if (newValues.length == 0) return undefined
            this.data[i] = new Set(currSet)
            return newValues
        }
    }

    static applyGrowingSet<V>(into: Set<V>, change: V[] | undefined) {
        if (!change) return
        for (const v of change) {
            into.add(v)
        }
    }
}
