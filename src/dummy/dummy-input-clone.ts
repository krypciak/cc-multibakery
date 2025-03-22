import { prestart } from '../plugin'

import './gamepad-assigner'

class InputManagerClazz implements dummy.InputManager {
    player!: dummy.DummyPlayer
    input: ig.Input
    gamepadManager: dummy.input.Clone.GamepadManager
    screen: Vec2 = { x: 0, y: 0 }
    ignoreKeyboardInput: Set<string> = new Set()
    ignoreGamepadInput: Set<string> = new Set()

    constructor(realInput: ig.Input, realGamepadManager: ig.GamepadManager, forceInputType?: ig.INPUT_DEVICES) {
        this.input = new dummy.input.Clone.Input(realInput, this)
        this.gamepadManager = new dummy.input.Clone.GamepadManager(realGamepadManager, this)

        if (forceInputType == ig.INPUT_DEVICES.GAMEPAD) {
            this.ignoreKeyboardInput.add('forceInputType')
        } else if (forceInputType == ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE) {
            this.ignoreGamepadInput.add('forceInputType')
        }
    }

    gatherInput() {
        if (this.ignoreKeyboardInput) return undefined

        return ig.ENTITY.Player.prototype.gatherInput.call(this.player)
    }

    isKeyboardBlocked() {
        return this.ignoreKeyboardInput.size > 0
    }

    isGamepadBlocked() {
        return this.ignoreGamepadInput.size > 0
    }
}

declare global {
    namespace dummy {
        namespace input {
            namespace Clone {
                type InputManager = InputManagerClazz
                let InputManager: typeof InputManagerClazz
            }
        }
    }
}
prestart(() => {
    dummy.input ??= {} as any
    dummy.input.Clone = {} as any

    dummy.input.Clone.InputManager = InputManagerClazz
}, 2)

declare global {
    namespace dummy.input.Clone {
        interface Input extends ig.Input {
            realInput: ig.Input
            manager: dummy.input.Clone.InputManager
        }
        interface InputConstructor extends ImpactClass<Input> {
            new (realInput: ig.Input, manager: dummy.input.Clone.InputManager): Input
        }
        var Input: InputConstructor
    }
    namespace ig {
        interface Input {
            _mouseGuiActive?: boolean
            _currentDevice?: ig.INPUT_DEVICES
            _mouse?: Vec2
        }
    }
}
prestart(() => {
    // prettier-ignore
    dummy.input.Clone.Input = ig.Input.extend({
        init(realInput, manager) {
            this.realInput = realInput
            this.manager = manager

            const self = this

            self.mouse = realInput._mouse = realInput.mouse
            self.mouseGuiActive = realInput._mouseGuiActive = realInput.mouseGuiActive
            self.currentDevice = realInput._currentDevice = realInput.currentDevice

            Object.defineProperties(realInput, {
                "mouseGuiActive": {
                    get() { return realInput._mouseGuiActive },
                    set(v) { self.mouseGuiActive = realInput._mouseGuiActive = v },
                },
                "currentDevice": {
                    get() { return realInput._currentDevice },
                    set(v) { self.currentDevice = realInput._currentDevice = v },
                },
            })
        },
        state(action) {
            if (this.manager.isKeyboardBlocked()) return false
            return this.realInput.state(action)
        },
        pressed(action) {
            if (this.manager.isKeyboardBlocked()) return false
            return this.realInput.pressed(action)
        },
        keyupd(action) {
            if (this.manager.isKeyboardBlocked()) return false
            return this.realInput.keyupd(action)
        },

        initMouse() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        initKeyboard() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        initAccelerometer() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        mousewheel(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        mousemove(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        mouseout() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        mouseOutOfScreen() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        contextmenu(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        isInIframe() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        isInIframeAndUnfocused() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        keydown(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        keyup(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        blur(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        focus() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        devicemotion(_event) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        bind(_key, _action) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        bindTouch(_key, _action) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        unbind(_key) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        unbindAll() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        clearPressed() { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        touchStart(_key, _action) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
        touchEnd(_key, _action) { throw new Error('called dummy.inputManagers.Clone.Input unimplemented function') },
    })
}, 3)

declare global {
    namespace dummy.input.Clone {
        interface GamepadManager extends ig.GamepadManager {
            realGM: ig.GamepadManager
            manager: dummy.input.Clone.InputManager
        }
        interface GamepadManagerConstructor extends ImpactClass<GamepadManager> {
            new (realGamepadManager: ig.GamepadManager, inputManager: dummy.input.Clone.InputManager): GamepadManager
        }
        var GamepadManager: GamepadManagerConstructor
    }
}
prestart(() => {
    dummy.input.Clone.GamepadManager = ig.GamepadManager.extend({
        init(realGM, inputManager) {
            this.realGM = realGM
            this.manager = inputManager
            this.gamepads = undefined as any
            this.activeGamepads = realGM.activeGamepads
        },
        isButtonPressed(button) {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isButtonPressed(button)
        },
        isButtonReleased(button) {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isButtonReleased(button)
        },
        isButtonDown(button) {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isButtonDown(button)
        },
        getButtonValue(button) {
            if (this.manager.isGamepadBlocked()) return 0
            return this.realGM.getButtonValue(button)
        },
        getAxesValue(axis, clipDeadZone) {
            if (this.manager.isGamepadBlocked()) return 0
            return this.realGM.getAxesValue(axis, clipDeadZone)
        },
        isAxesDown(axis) {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isAxesDown(axis)
        },
        isLeftStickDown() {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isLeftStickDown()
        },
        isRightStickDown() {
            if (this.manager.isGamepadBlocked()) return false
            return this.realGM.isRightStickDown()
        },
    })
}, 3)
