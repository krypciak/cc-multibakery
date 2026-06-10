type ProfileLabel = string | ((self: any, ...args: any[]) => string)

// this decorator gets stripped out of builds when building without the profile flag
export function profile(label?: ProfileLabel) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        if (!PROFILE) return descriptor

        const fn = descriptor.value
        const isAsync = fn.constructor.name === 'AsyncFunction'

        descriptor.value = function (this: any, ...args: any[]) {
            let labelStr = typeof label === 'function' ? label(this, ...args) : label
            labelStr ??= ''
            if (labelStr) labelStr += ' '
            labelStr += _propertyKey

            console.time(labelStr)
            try {
                const result = fn.apply(this, args)
                if (isAsync) {
                    return (result as Promise<any>).finally(() => console.timeEnd(labelStr))
                }
                console.timeEnd(labelStr)
                return result
            } catch (e) {
                console.timeEnd(labelStr)
                throw e
            }
        }
        return descriptor
    }
}
