import { DummyUpdateGamepadInput, DummyUpdateInput } from '../api'
import { prestart } from '../plugin'

class InputManagerClazz implements dummy.InputManager {
    static emptyGatherInput(): ig.ENTITY.Player.PlayerInput {
        return {
            thrown: false,
            melee: false,
            aimStart: false,
            aim: false,
            attack: false,
            autoThrow: false,
            charge: false,
            dashX: 0,
            dashY: 0,
            guard: false,
            relativeVel: 0,
            moveDir: Vec2.create(),
            lastMoveDir: Vec2.create(),
            switchMode: false,
            /* charging crashes */
        }
    }

    static getDummyUpdateKeyboardInputFromIgInput(input: ig.Input): DummyUpdateInput {
        return {
            isUsingMouse: input.isUsingMouse,
            isUsingKeyboard: input.isUsingKeyboard,
            isUsingAccelerometer: input.isUsingAccelerometer,
            ignoreKeyboard: input.ignoreKeyboard,
            mouseGuiActive: input.mouseGuiActive,
            mouse: input.mouse,
            accel: input.accel,
            presses: input.presses,
            keyups: input.keyups,
            locks: input.locks,
            delayedKeyup: input.delayedKeyup,
            currentDevice: input.currentDevice,
            actions: input.actions,
        }
    }

    static getDummyUpdateGamepadInputFromIgGamepadManager(
        gamepadmanager: ig.GamepadManager
    ): DummyUpdateGamepadInput | undefined {
        const gp = gamepadmanager.activeGamepads[0]
        if (!gp) return
        return {
            buttonDeadzones: gp.buttonDeadzones,
            axesStates: gp.axesStates,
            buttonStates: gp.buttonStates,
            axesDeadzones: gp.axesDeadzones,
            pressedStates: gp.pressedStates,
            releasedStates: gp.releasedStates,
        }
    }

    player!: dummy.DummyPlayer
    input: dummy.inputManagers.Puppet.Input
    gamepadManager: dummy.inputManagers.Puppet.GamepadManager
    screen: Vec2 = { x: 0, y: 0 }

    nextGatherInput?: ig.ENTITY.Player.PlayerInput

    constructor() {
        this.input = new dummy.inputManagers.Puppet.Input()
        this.gamepadManager = new dummy.inputManagers.Puppet.GamepadManager()
    }

    gatherInput() {
        return this.nextGatherInput
    }
}

declare global {
    namespace dummy {
        namespace inputManagers {
            namespace Puppet {
                let InputManager: typeof InputManagerClazz
            }
        }
    }
}
prestart(() => {
    dummy.inputManagers ??= {} as any
    dummy.inputManagers.Puppet = {} as any

    dummy.inputManagers.Puppet.InputManager = InputManagerClazz
}, 2)

declare global {
    namespace dummy.inputManagers.Puppet {
        interface Input extends ig.Input {
            _lastInput: DummyUpdateInput

            getInput(this: this): DummyUpdateInput
            setInput(this: this, input: DummyUpdateInput): void
        }
        interface InputConstructor extends ImpactClass<Input> {
            new (): Input
        }
        var Input: InputConstructor
    }
}
prestart(() => {
    dummy.inputManagers.Puppet.Input = ig.Input.extend({
        init() {
            this.bindings = ig.input.bindings
        },
        getInput() {
            return (
                this._lastInput ?? dummy.inputManagers.Puppet.InputManager.getDummyUpdateKeyboardInputFromIgInput(this)
            )
        },
        setInput(input) {
            this._lastInput = input
            for (const key of Object.keysT(input)) {
                const value = input[key]
                if (typeof value === 'function') continue
                // @ts-expect-error
                this[key] = value
            }
        },
    })
}, 3)

declare global {
    namespace dummy.inputManagers.Puppet {
        interface GamepadManager extends ig.GamepadManager {
            _lastInput: DummyUpdateGamepadInput

            getInput(this: this): DummyUpdateGamepadInput
            setInput(this: this, input: DummyUpdateGamepadInput): void
        }
        interface GamepadManagerConstructor extends ImpactClass<GamepadManager> {
            new (): GamepadManager
        }
        var GamepadManager: GamepadManagerConstructor
    }
}
prestart(() => {
    dummy.inputManagers.Puppet.GamepadManager = ig.GamepadManager.extend({
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
        getInput() {
            return (
                this._lastInput ??
                dummy.inputManagers.Puppet.InputManager.getDummyUpdateGamepadInputFromIgGamepadManager(this)
            )
        },
        setInput(input) {
            this._lastInput = input
            // @ts-expect-error
            this.activeGamepads[0] = input
        },
        isSupported() {
            return true
        },
    })
}, 3)
