import { prestart } from '../plugin'
import { InputManagerBlock } from './dummy-input-clone'

export interface InputData {
    isUsingMouse: boolean
    isUsingKeyboard: boolean
    ignoreKeyboard: boolean
    mouseGuiActive: boolean
    mouse: Vec2
    accel: Vec3
    presses: ig.Input['presses']
    keyups: ig.Input['keyups']
    locks: ig.Input['locks']
    delayedKeyup: ig.Input['delayedKeyup']
    currentDevice: ig.Input['currentDevice']
    actions: ig.Input['actions']
}

export interface GamepadManagerData {
    buttonDeadzones: Record<ig.BUTTONS, number>
    axesDeadzones: Record<ig.BUTTONS, number>
    buttonStates: Record<ig.BUTTONS, number>
    axesStates: Record<ig.BUTTONS, number>
    pressedStates: Record<ig.BUTTONS, boolean>
    releasedStates: Record<ig.BUTTONS, boolean>
}

declare global {
    namespace dummy {
        namespace input {
            namespace Puppet {
                type InputManager = InstanceType<ReturnType<typeof initInputManager>>
                let InputManager: ReturnType<typeof initInputManager>
            }
        }
    }
}

function initInputManager() {
    class PuppetInputManager extends dummy.input.Clone.InputManager {
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

        static getInputData(input: ig.Input): InputData {
            return {
                isUsingMouse: input.isUsingMouse,
                isUsingKeyboard: input.isUsingKeyboard,
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

        static getGamepadManagerData(gamepadmanager: ig.GamepadManager): GamepadManagerData | undefined {
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

        mainInputData: dummy.input.Puppet.Input
        mainGamepadManagerData: dummy.input.Puppet.GamepadManager

        mainBlock: InputManagerBlock

        mainInput: dummy.input.Clone.Input
        mainGamepadManager: dummy.input.Clone.GamepadManager

        nextGatherInput?: ig.ENTITY.Player.PlayerInput

        constructor() {
            const mainInputData = new dummy.input.Puppet.Input()
            const mainGamepadManagerData: dummy.input.Puppet.GamepadManager = new dummy.input.Puppet.GamepadManager()

            const mainBlock = new InputManagerBlock()

            const mainInput = new dummy.input.Clone.Input(mainInputData, mainBlock)
            const mainGamepadManager = new dummy.input.Clone.GamepadManager(mainGamepadManagerData, mainBlock)

            super(mainInput, mainGamepadManager, undefined)

            this.mainInputData = mainInputData
            this.mainGamepadManagerData = mainGamepadManagerData
            this.mainBlock = mainBlock
            this.mainInput = mainInput
            this.mainGamepadManager = mainGamepadManager
        }

        gatherInput() {
            return this.nextGatherInput
        }
    }

    dummy.input.Puppet.InputManager = PuppetInputManager
    return PuppetInputManager
}

prestart(() => {
    dummy.input ??= {} as any
    dummy.input.Puppet = {} as any
    initInputManager()
}, 4)

declare global {
    namespace dummy.input.Puppet {
        interface Input extends ig.Input {
            inputQueue: InputData[]

            setInput(this: this, input: InputData): void
            pushInput(this: this, input: InputData): void
            popInput(this: this): void
        }
        interface InputConstructor extends ImpactClass<Input> {
            new (): Input
        }
        var Input: InputConstructor
    }
}
prestart(() => {
    dummy.input.Puppet.Input = ig.Input.extend({
        init() {
            this.bindings = ig.input.bindings
            this.inputQueue = []
        },
        setInput(input) {
            this.isUsingMouse = input.isUsingMouse
            this.isUsingKeyboard = input.isUsingKeyboard
            this.ignoreKeyboard = input.ignoreKeyboard
            this.mouseGuiActive = input.mouseGuiActive
            Vec2.assign(this.mouse, input.mouse)
            Vec3.assign(this.accel, input.accel)
            this.presses = input.presses
            this.keyups = input.keyups
            this.locks = input.locks
            this.delayedKeyup = input.delayedKeyup
            this.currentDevice = input.currentDevice
            this.actions = input.actions
        },
        pushInput(input) {
            this.inputQueue.push(input)
            this.popInput()
        },
        popInput() {
            if (this.inputQueue.length > 0) {
                const ele = this.inputQueue[0]
                this.inputQueue.splice(0, 1)
                this.setInput(ele)
            }
        },
    })
}, 5)

declare global {
    namespace dummy.input.Puppet {
        interface GamepadManager extends ig.GamepadManager {
            _lastInput: GamepadManagerData

            getInput(this: this): GamepadManagerData
            pushInput(this: this, input: GamepadManagerData): void
            setInput(this: this, input: GamepadManagerData): void
        }
        interface GamepadManagerConstructor extends ImpactClass<GamepadManager> {
            new (): GamepadManager
        }
        var GamepadManager: GamepadManagerConstructor
    }
}
prestart(() => {
    dummy.input.Puppet.GamepadManager = ig.GamepadManager.extend({
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
            return this._lastInput ?? dummy.input.Puppet.InputManager.getGamepadManagerData(this)
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
}, 5)
