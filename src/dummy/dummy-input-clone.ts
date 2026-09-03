import { prestart } from '../loading-stages'

import './gamepad-assigner'

export class InputManagerBlock {
    private ignoreKeyboardInput: Set<string> = new Set()
    private ignoreGamepadInput: Set<string> = new Set()

    isKeyboardBlocked() {
        return this.ignoreKeyboardInput.size > 0
    }

    isGamepadBlocked() {
        return this.ignoreGamepadInput.size > 0
    }

    blockKeyboard(id: string) {
        this.ignoreKeyboardInput.add(id)
    }
    blockGamepad(id: string) {
        this.ignoreGamepadInput.add(id)
    }
    blockBoth(id: string) {
        this.blockKeyboard(id)
        this.blockGamepad(id)
    }

    unblockKeyboard(id: string) {
        this.ignoreKeyboardInput.delete(id)
    }
    unblockGamepad(id: string) {
        this.ignoreGamepadInput.delete(id)
    }
    unblockBoth(id: string) {
        this.unblockKeyboard(id)
        this.unblockGamepad(id)
    }
}

class CloneInputManager {
    player!: dummy.DummyPlayer
    input: dummy.input.Clone.Input
    gamepadManager: dummy.input.Clone.GamepadManager
    screen: Vec2 = { x: 0, y: 0 }
    inputType!: ig.INPUT_DEVICES | undefined
    block = new InputManagerBlock()

    constructor(realInput: ig.Input, realGamepadManager: ig.GamepadManager, inputType: ig.INPUT_DEVICES | undefined) {
        this.input = new dummy.input.Clone.Input(realInput, this.block)
        this.gamepadManager = new dummy.input.Clone.GamepadManager(realGamepadManager, this.block)

        this.setInputType(inputType)
    }

    setInputType(inputType: ig.INPUT_DEVICES | undefined) {
        this.inputType = inputType
    }

    destroy() {
        this.gamepadManager.destroy()
    }
}

declare global {
    namespace dummy {
        namespace input {
            namespace Clone {
                type InputManager = CloneInputManager
                let InputManager: typeof CloneInputManager
            }
        }
    }
}
prestart(() => {
    dummy.input ??= {} as any
    dummy.input.Clone = {} as any

    dummy.input.Clone.InputManager = CloneInputManager
}, 2)

declare global {
    namespace dummy.input.Clone {
        interface Input extends ig.Input {
            realInput: ig.Input
            block: InputManagerBlock
        }
        interface InputConstructor extends ImpactClass<Input> {
            new (realInput: ig.Input, block: InputManagerBlock): Input
        }
        var Input: InputConstructor
    }
}
prestart(() => {
    dummy.input.Clone.Input = ig.Input.extend({
        init(realInput, block) {
            this.realInput = realInput
            this.block = block

            const self = this

            self.mouse = realInput.mouse

            Object.defineProperties(self, {
                mouseGuiActive: {
                    get() {
                        return realInput.mouseGuiActive
                    },
                    set(_v) {},
                },
                currentDevice: {
                    get() {
                        return realInput.currentDevice
                    },
                    set(_v) {},
                },
            })
        },
        state(action) {
            if (this.block.isKeyboardBlocked()) return false
            return this.realInput.state(action)
        },
        pressed(action) {
            if (this.block.isKeyboardBlocked()) return false
            return this.realInput.pressed(action)
        },
        keyupd(action) {
            if (this.block.isKeyboardBlocked()) return false
            return this.realInput.keyupd(action)
        },
        mouseOutOfScreen() {
            return this.realInput.mouseOutOfScreen()
        },
        clearPressed() {
            return this.realInput.clearPressed()
        },

        // prettier-ignore
        ...{
        initMouse() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        initKeyboard() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        initAccelerometer() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        mousewheel(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        mousemove(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        mouseout() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        contextmenu(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        isInIframe() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        isInIframeAndUnfocused() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        keydown(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        keyup(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        blur(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        focus() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        devicemotion(_event) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        bind(_key, _action) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        bindTouch(_key, _action) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        unbind(_key) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        unbindAll() { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        touchStart(_key, _action) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        touchEnd(_key, _action) { throw new Error('called dummy.input.Clone.Input unimplemented function') },
        },
    })
}, 3)

declare global {
    namespace dummy.input.Clone {
        interface GamepadManager extends ig.GamepadManager {
            realGM: ig.GamepadManager
            block: InputManagerBlock
        }
        interface GamepadManagerConstructor extends ImpactClass<GamepadManager> {
            new (realGamepadManager: ig.GamepadManager, block: InputManagerBlock): GamepadManager
        }
        var GamepadManager: GamepadManagerConstructor
    }
}
prestart(() => {
    dummy.input.Clone.GamepadManager = ig.GamepadManager.extend({
        init(realGM, block) {
            this.realGM = realGM
            this.block = block
            this.gamepads = undefined as any
            this.activeGamepads = realGM.activeGamepads
        },
        isButtonPressed(button) {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isButtonPressed(button)
        },
        isButtonReleased(button) {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isButtonReleased(button)
        },
        isButtonDown(button) {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isButtonDown(button)
        },
        getButtonValue(button) {
            if (this.block.isGamepadBlocked()) return 0
            return this.realGM.getButtonValue(button)
        },
        getAxesValue(axis, clipDeadZone) {
            if (this.block.isGamepadBlocked()) return 0
            return this.realGM.getAxesValue(axis, clipDeadZone)
        },
        isAxesDown(axis) {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isAxesDown(axis)
        },
        isLeftStickDown() {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isLeftStickDown()
        },
        isRightStickDown() {
            if (this.block.isGamepadBlocked()) return false
            return this.realGM.isRightStickDown()
        },
        destroy() {
            this.parent?.()
            this.realGM.destroy?.()
        },
    })
}, 3)
