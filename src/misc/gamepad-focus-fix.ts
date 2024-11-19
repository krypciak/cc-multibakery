import { prestart } from '../plugin'
import './real-window-focus'

prestart(() => {
    ig.GamepadManager.inject({
        isButtonPressed(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
        isButtonReleased(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
        isButtonDown(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
        getButtonValue(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return 0
            return this.parent(...args)
        },
        getAxesValue(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return 0
            return this.parent(...args)
        },
        isAxesDown(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
        isLeftStickDown(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
        isRightStickDown(...args) {
            if (!ig.isWindowFocused && !(this instanceof ig.dummy.GamepadManager)) return false
            return this.parent(...args)
        },
    })
})
