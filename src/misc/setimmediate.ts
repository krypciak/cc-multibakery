import { preload } from '../loading-stages'

preload(() => {
    // @ts-expect-error
    global.setImmediate ??= function (func: () => void) {
        return setTimeout(func, 0) as unknown as NodeJS.Immediate
    }
    window.setImmediate ??= global.setImmediate

    global.clearImmediate ??= function (id: any) {
        clearTimeout(id)
    }
    window.clearImmediate ??= global.clearImmediate
})
