import { prestart } from '../plugin'
import { assert } from './assert'

function disable(name: keyof typeof window) {
    const orig = window[name]
    assert(typeof orig == 'function')
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
