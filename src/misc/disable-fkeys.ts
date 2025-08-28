import { prestart } from '../loading-stages'

function disable(name: keyof typeof window) {
    const orig = window[name]
    if (!orig) return
    // @ts-expect-error
    window[name] = () => {
        if (multi.server) return
        return orig()
    }
}

prestart(() => {
    disable('SHOW_GAMECODE')
    disable('SHOW_TWITTER')
    disable('SHOW_SCREENSHOT')
    disable('SHOW_INDIEGOGO')
    disable('SHOW_SAVE_DIALOG')
})
