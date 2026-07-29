import { prestart } from '../loading-stages'

declare global {
    namespace multi {
        var perf: Perf
    }
}

class Perf {
    data: Record<string, Record<string, number[]>> = {}

    getTimesArray(label: string, prefix: string): number[] {
        const rec = (this.data[label] ??= {})
        const arr = (rec[prefix] ??= [])
        return arr
    }

    addTimePoint(label: string, prefix: string, time: number) {
        const arr = this.getTimesArray(label, prefix)
        arr.push(time)
        // console.log(prefix, label, time)
    }

    printStats(label: string, prefix: string) {
        console.log(label, prefix)
    }
}

prestart(() => {
    if (!PROFILE) return

    multi.perf = new Perf()
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
                multi.perf.addTimePoint(labelStr, prefixStr, end - start)
            }
            if (!frequent) {
                consoleLabel =
                    multi.perf.getTimesArray(labelStr, prefixStr).length +
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
