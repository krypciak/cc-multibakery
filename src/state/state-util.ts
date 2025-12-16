import { isPhysics } from '../server/physics/is-physics-server'

export function shouldCollectStateData(): boolean {
    return isPhysics(multi.server) && multi.server.anyRemoteClientsOn
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

    isFirstTime() {
        return this.data.length <= this.i
    }

    diffRecord<T extends object>(
        currRecord: T,
        eq: (a: T[keyof T], b: T[keyof T] | undefined) => boolean = (a, b) => a == b
    ): T | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push({ ...currRecord })
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
                    lastRecord[key] = currValue
                    changed[key] = currValue
                    atLeastOne = true
                }
            }

            return atLeastOne ? changed : undefined
        }
    }

    diffRecord2Deep<K2 extends string, R extends PartialRecord<K2, unknown>>(
        currRecord: Record<string, R>,
        notEqMap: { [K in keyof R]?: (a: R[K], b: R[K]) => boolean } = {},
        cloneMap: { [K in keyof R]?: (obj: R[K]) => R[K] } = {}
    ): Record<string, R> | undefined {
        const i = this.i++
        if (this.data.length <= i) {
            this.data.push(currRecord)
            return currRecord
        } else {
            function cloneRecord(rec: R): R {
                return Object.fromEntries(
                    Object.entries(rec).map(([k, v]) => [k, cloneMap[k as keyof R]?.(v as R[keyof R]) ?? v])
                ) as R
            }

            const lastRecord = this.data[i] as Record<string, R>
            const changed: Record<string, R> = {}
            let atLeastOne = false

            for (const key1 in currRecord) {
                const currSubR = currRecord[key1] as R
                const lastSubR = lastRecord[key1] as R | undefined

                if (!lastSubR) {
                    lastRecord[key1] = cloneRecord(currSubR)
                    changed[key1] = currSubR
                    atLeastOne = true
                } else {
                    for (const key2 in currSubR) {
                        const currV = currSubR[key2]
                        const lastV = lastSubR[key2]
                        if (notEqMap[key2]?.(currV, lastV) ?? currV != lastV) {
                            lastSubR[key2] = cloneMap[key2]?.(currV) ?? currV

                            changed[key1] ??= {} as R
                            changed[key1][key2] = currV
                            atLeastOne = true
                        }
                    }
                }
            }
            for (const key1 in lastRecord) {
                if (currRecord[key1] === undefined && lastRecord[key1] !== undefined) {
                    lastRecord[key1] = undefined as any
                    changed[key1] = undefined as any
                    atLeastOne = true
                }
            }

            return atLeastOne ? changed : undefined
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
}
