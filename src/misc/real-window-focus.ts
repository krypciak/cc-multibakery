import { prestart } from '../plugin'

declare global {
    namespace ig {
        var isWindowFocused: boolean
    }
}

prestart(() => {
    ig.Input.inject({
        blur(event) {
            this.parent(event)
            ig.isWindowFocused = false
        },
        focus() {
            this.parent()
            ig.isWindowFocused = true
        },
    })
})
