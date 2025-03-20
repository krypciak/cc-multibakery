import { prestart } from '../plugin'

class InputManagerClazz implements dummy.InputManager {
    player!: dummy.DummyPlayer
    input: ig.Input
    gamepadManager: dummy.inputManagers.Clone.GamepadManager
    screen: Vec2 = { x: 0, y: 0 }
    ignoreInput = false

    constructor(realInput: ig.Input) {
        this.input = new dummy.inputManagers.Clone.Input(realInput, this)
        this.gamepadManager = new dummy.inputManagers.Clone.GamepadManager()
    }

    gatherInput() {
        if (this.ignoreInput) return undefined

        return ig.ENTITY.Player.prototype.gatherInput.call(this.player)
    }
}

declare global {
    namespace dummy {
        namespace inputManagers {
            namespace Clone {
                type InputManager = InputManagerClazz
                let InputManager: typeof InputManagerClazz
            }
        }
    }
}
prestart(() => {
    dummy.inputManagers ??= {} as any
    dummy.inputManagers.Clone = {} as any

    dummy.inputManagers.Clone.InputManager = InputManagerClazz
}, 2)

declare global {
    namespace dummy.inputManagers.Clone {
        interface Input extends ig.Input {
            realInput: ig.Input
            manager: dummy.inputManagers.Clone.InputManager
        }
        interface InputConstructor extends ImpactClass<Input> {
            new (realInput: ig.Input, manager: dummy.inputManagers.Clone.InputManager): Input
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
    dummy.inputManagers.Clone.Input = ig.Input.extend({
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
            if (this.manager.ignoreInput) return false
            return this.realInput.actions[action]
        },
        pressed(action) {
            if (!ig.game.firstUpdateLoop) return false
            if (this.manager.ignoreInput) return false
            return this.realInput.presses[action]
        },
        keyupd(action) {
            if (!ig.game.firstUpdateLoop) return false
            if (this.manager.ignoreInput) return false
            return this.realInput.keyups[action]
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
    namespace dummy.inputManagers.Clone {
        interface GamepadManager extends ig.GamepadManager {}
        interface GamepadManagerConstructor extends ImpactClass<GamepadManager> {
            new (): GamepadManager
        }
        var GamepadManager: GamepadManagerConstructor
    }
}
prestart(() => {
    dummy.inputManagers.Clone.GamepadManager = ig.GamepadManager.extend({
        init() {
            this.activeGamepads = [
                // @ts-expect-error
                {
                    buttonDeadzones: [] as any,
                    axesDeadzones: [] as any,
                    buttonStates: [] as any,
                    axesStates: [] as any,
                    pressedStates: [] as any,
                    releasedStates: [] as any,
                },
            ]
        },
        isSupported() {
            return true
        },
    })
}, 3)
