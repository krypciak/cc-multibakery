import { prestart } from '../loading-stages'

function percentile(values: number[], p: number) {
    const index = Math.ceil(values.length * p) - 1
    return values[Math.max(0, index)]
}

type Stats = ReturnType<typeof calcNumericStats>
function calcNumericStats(timesOrig: number[]) {
    const times = [...timesOrig]
    if (times.length == 0) throw new Error('calcNumericStats supplied 0 length array!')
    times.sort((a, b) => a - b)
    const p50 = percentile(times, 0.5)
    const p95 = percentile(times, 0.95)
    const p99 = percentile(times, 0.99)
    const min = times[0]
    const max = times[times.length - 1]
    const avg = times.reduce((acc, v) => acc + v, 0) / times.length
    return { count: times.length, p50, p95, p99, min, max, avg }
}

function printStats(stats: Stats, indent: number = 0) {
    const pad = '  '.repeat(indent)
    console.log(
        pad +
            `count=${stats.count} ` +
            `min=${stats.min.toFixed(2)} ` +
            `p50=${stats.p50.toFixed(2)} ` +
            `p95=${stats.p95.toFixed(2)} ` +
            `p99=${stats.p99.toFixed(2)} ` +
            `avg=${stats.avg.toFixed(2)} ` +
            `max=${stats.max.toFixed(2)}`
    )
}

class CircularBuffer<T> {
    private arr: T[]
    private index: number = 0
    private count: number = 0

    constructor(private capacity: number) {
        this.arr = new Array(capacity)
    }

    push(value: T) {
        this.arr[this.index] = value
        this.index = (this.index + 1) % this.capacity
        if (this.count < this.capacity) this.count++
    }

    get(): T[] {
        return this.arr.slice(0, this.count)
    }

    length(): number {
        return this.count
    }
}

declare global {
    namespace multi {
        var perf: Perf
    }
}

class Perf {
    data: Record<string, Record<string, CircularBuffer<number>>> = {}

    getTimesCircularBuffer(label: string, prefix: string): CircularBuffer<number> {
        const rec = (this.data[label] ??= {})
        const buf = (rec[prefix] ??= new CircularBuffer(60 * 30))
        return buf
    }

    addTimePoint(label: string, prefix: string, time: number) {
        const arr = this.getTimesCircularBuffer(label, prefix)
        arr.push(time)
    }

    printStats(label: string, prefix?: string) {
        const rec = this.data[label]
        if (!rec) {
            console.error(`no such label: "${label}"`)
            return
        }
        let prefixes: string[]
        if (prefix) {
            if (!rec[prefix]) {
                console.error(`no such prefix: "${prefix}" in label: "${label}"`)
                return
            }
            prefixes = [prefix]
        } else {
            prefixes = Object.keys(rec)
        }

        if (prefixes.length == 0) {
            console.log(`no data to print in label: "${label}"`)
            return
        }
        console.log(`${label}:`)

        for (const prefix of prefixes) {
            console.log(`  ${prefix}:`)
            const times = this.getTimesCircularBuffer(label, prefix).get()
            const stats = calcNumericStats(times)
            printStats(stats, 2)
        }
    }
}

const perf = (PROFILE && new Perf()) as Perf

prestart(() => {
    if (!PROFILE) return
    multi.perf = perf
})

type TextGenerator<S, T extends unknown[]> = string | ((self: S, ...args: T) => string)

export function profile<S, T extends unknown[]>(
    prefix?: TextGenerator<S, T>,
    label?: TextGenerator<S, T>,
    frequent?: boolean
) {
    return function (_target: S, _propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: T) => any>) {
        if (!PROFILE) return descriptor

        const fn = descriptor.value!
        const isAsync = fn.constructor.name === 'AsyncFunction'

        descriptor.value = function (this: S, ...args: T) {
            let labelStr = typeof label === 'function' ? label(this, ...args) : (label ?? '')
            if (labelStr) labelStr += ' '
            labelStr += _propertyKey

            const prefixStr = typeof prefix === 'function' ? prefix(this, ...args) : (prefix ?? '')

            let consoleLabel: string | undefined

            const finalize = () => {
                const end = performance.now()
                if (!frequent) console.timeEnd(consoleLabel)
                perf.addTimePoint(labelStr, prefixStr, end - start)
            }
            if (!frequent) {
                consoleLabel =
                    perf.getTimesCircularBuffer(labelStr, prefixStr).length() +
                    ' ' +
                    (prefixStr ? prefixStr + ' ' : '') +
                    labelStr
                console.time(consoleLabel)
            }
            const start = performance.now()
            if (isAsync) {
                const result: Promise<unknown> = fn.apply(this, args)
                result.finally(finalize)
                return result
            } else {
                try {
                    return fn.apply(this, args)
                } finally {
                    finalize()
                }
            }
        }
        return descriptor
    }
}
