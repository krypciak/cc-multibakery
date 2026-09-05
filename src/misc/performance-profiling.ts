import { prestart } from '../loading-stages'
import { CircularBuffer } from './circular-buffer'

function percentile(values: number[], p: number) {
    const index = Math.ceil(values.length * p) - 1
    return values[Math.max(0, index)]
}

type Stats = ReturnType<typeof calcNumericStats>
function calcNumericStats(timesOrig: number[]) {
    const times = [...timesOrig]
    if (times.length == 0) return { count: 0, p50: NaN, p95: NaN, p99: NaN, min: NaN, max: NaN, avg: NaN }
    times.sort((a, b) => a - b)
    const p50 = percentile(times, 0.5)
    const p95 = percentile(times, 0.95)
    const p99 = percentile(times, 0.99)
    const min = times[0]
    const max = times[times.length - 1]
    const avg = times.reduce((acc, v) => acc + v, 0) / times.length
    return { count: times.length, p50, p95, p99, min, max, avg }
}

function statsToString(stats: Partial<Stats>, precision: number = 2) {
    let str = ''
    if (stats.count !== undefined) str += `count=${stats.count} `
    if (stats.min !== undefined) str += `min=${stats.min.toFixed(precision)} `
    if (stats.p50 !== undefined) str += `p50=${stats.p50.toFixed(precision)} `
    if (stats.p95 !== undefined) str += `p95=${stats.p95.toFixed(precision)} `
    if (stats.p99 !== undefined) str += `p99=${stats.p99.toFixed(precision)} `
    if (stats.avg !== undefined) str += `avg=${stats.avg.toFixed(precision)} `
    if (stats.max !== undefined) str += `max=${stats.max.toFixed(precision)} `
    return str.trimEnd()
}

function pick<K extends PropertyKey, V extends Record<K, unknown>>(obj: V, keys?: K[]): Partial<V> {
    if (!keys) return obj
    const newObj = {} as Partial<V>
    for (const key of keys) newObj[key] = obj[key]
    return newObj
}

interface PrintOptions {
    precision?: number
    keys?: (keyof Stats)[]
}

class Perf {
    data: Record<string, Record<string, CircularBuffer<number>>> = {}

    getTimesCircularBuffer(label: string, prefix: string): CircularBuffer<number> {
        const rec = (this.data[label] ??= {})
        const buf = (rec[prefix] ??= new CircularBuffer(60 * 30))
        return buf
    }

    addTimePoint(label: string, prefix: string, time: number) {
        time = Math.max(time, 0)
        const arr = this.getTimesCircularBuffer(label, prefix)
        arr.push(time)
    }

    printStatsToString(label: string, prefix: string, { precision, keys }: PrintOptions = {}) {
        const times = this.getTimesCircularBuffer(label, prefix).get()
        const stats = calcNumericStats(times)
        return statsToString(pick(stats, keys), precision)
    }

    printStats(label: string, prefix?: string, printOptions?: PrintOptions) {
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
            console.log('  '.repeat(2) + this.printStatsToString(label, prefix, printOptions))
        }
    }
}

const perf = (PROFILE && new Perf()) as Perf

declare global {
    namespace multi {
        var perf: Perf
    }
}

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
