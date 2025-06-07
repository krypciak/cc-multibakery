import { prestart } from '../plugin'
import { InputManagerBlock } from './dummy-input-clone'
import { defaultGamepadAxesDeadzones, defaultGamepadButtonDeadzones } from './fixed-Html5GamepadHandler'

export interface InputData {
    currentDevice: ig.Input['currentDevice']
    isUsingMouse?: boolean
    isUsingKeyboard?: boolean
    ignoreKeyboard?: boolean
    mouseGuiActive?: boolean
    mouse?: Vec2
    accel?: Vec3
    presses?: ig.Input['presses']
    keyups?: ig.Input['keyups']
    locks?: ig.Input['locks']
    delayedKeyup?: ig.Input['delayedKeyup']
    actions?: ig.Input['actions']
}

export interface GamepadManagerData {
    buttonStates?: ig.Gamepad['buttonStates']
    axesStates?: ig.Gamepad['axesStates']
    pressedStates?: ig.Gamepad['pressedStates']
    releasedStates?: ig.Gamepad['releasedStates']
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
        mainInputData: dummy.input.Puppet.Input
        mainGamepadManagerData: dummy.input.Puppet.GamepadManager

        mainBlock: InputManagerBlock

        mainInput: dummy.input.Clone.Input
        mainGamepadManager: dummy.input.Clone.GamepadManager

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
    }

    dummy.input.Puppet.InputManager = PuppetInputManager
    return PuppetInputManager
}

prestart(() => {
    dummy.input ??= {} as any
    dummy.input.Puppet = {} as any
    initInputManager()
}, 4)

export const disallowedInputActions = ['snapshot', 'savedialog', 'langedit', 'fullscreen'] as const

export function isInputData(data: any): data is InputData {
    if (typeof data != 'object') return false

    if (data) {
        for (const action of disallowedInputActions) {
            if (data.presses?.[action]) return false
            if (data.actions?.[action]) return false
        }
    }

    return true
}

declare global {
    namespace ig {
        interface Input {
            getInput(this: this, isUsingGamepad: boolean): InputData
        }
    }
}
prestart(() => {
    ig.Input.inject({
        getInput(isUsingGamepad) {
            if (isUsingGamepad) {
                return {
                    currentDevice: ig.INPUT_DEVICES.GAMEPAD,
                    presses: this.presses['pause'] ? { pause: true } : undefined,
                }
            }

            function cleanRecord<T extends Record<string, boolean>>(rec: T): T | undefined {
                if (Object.keys(rec).length == 0) return undefined

                const newRecord: Record<string, boolean> = {}
                let atLeastOneKey = false
                for (const key in rec) {
                    if (rec[key]) {
                        newRecord[key] = true
                        atLeastOneKey = true
                    }
                }
                if (!atLeastOneKey) return undefined

                return newRecord as T
            }

            return {
                currentDevice: this.currentDevice ?? ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE,
                isUsingMouse: this.isUsingMouse ? true : undefined,
                isUsingKeyboard: this.isUsingKeyboard ? true : undefined,
                ignoreKeyboard: this.ignoreKeyboard ? true : undefined,
                mouseGuiActive: this.mouseGuiActive ? true : undefined,
                mouse: Vec2.isZero(this.mouse) ? undefined : this.mouse,
                accel: Vec3.isZero(this.accel) ? undefined : this.accel,
                presses: cleanRecord(this.presses),
                keyups: cleanRecord(this.keyups),
                locks: cleanRecord(this.locks),
                delayedKeyup: this.delayedKeyup.length == 0 ? undefined : this.delayedKeyup,
                actions: cleanRecord(this.actions),
            }
        },
    })
})

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
            this.isUsingMouse = input.isUsingMouse ?? false
            this.isUsingKeyboard = input.isUsingKeyboard ?? false
            this.ignoreKeyboard = input.ignoreKeyboard ?? false
            this.mouseGuiActive = input.mouseGuiActive ?? false
            Vec2.assign(this.mouse, input.mouse ?? Vec2.create())
            Vec3.assign(this.accel, input.accel ?? Vec3.create())
            this.presses = input.presses ?? {}
            this.keyups = input.keyups ?? {}
            this.locks = input.locks ?? {}
            this.delayedKeyup = input.delayedKeyup ?? []
            this.currentDevice = input.currentDevice
            this.actions = input.actions ?? {}
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
    namespace ig {
        interface GamepadManager {
            getInput(this: this): GamepadManagerData | undefined
        }
    }
}
prestart(() => {
    ig.GamepadManager.inject({
        getInput() {
            const gp = this.activeGamepads[0]
            if (!gp) return

            function cleanArray<T>(arr: T[]): T[] | undefined {
                for (const v of arr) if (v) return arr
                return undefined
            }

            return {
                axesStates: cleanArray(gp.axesStates),
                buttonStates: cleanArray(gp.buttonStates),
                pressedStates: cleanArray(gp.pressedStates),
                releasedStates: cleanArray(gp.releasedStates),
            }
        },
    })
})

export function isGamepadManagerData(data: any): data is GamepadManagerData {
    if (typeof data != 'object') return false

    if (data.buttonStates && (!Array.isArray(data.buttonStates) || data.buttonStates.length > 16)) return false
    if (data.axesStates && (!Array.isArray(data.axesStates) || data.axesStates.length > 4)) return false
    if (data.pressedStates && (!Array.isArray(data.pressedStates) || data.pressedStates.length > 16)) return false
    if (data.releasedStates && (!Array.isArray(data.releasedStates) || data.releasedStates.length > 16)) return false

    return true
}

declare global {
    namespace dummy.input.Puppet {
        interface GamepadManager extends ig.GamepadManager {
            inputQueue: GamepadManagerData[]

            pushInput(this: this, input: GamepadManagerData): void
            setInput(this: this, input: GamepadManagerData): void
            popInput(this: this): void
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
                    buttonDeadzones: defaultGamepadButtonDeadzones(),
                    axesDeadzones: defaultGamepadAxesDeadzones(),
                    buttonStates: [],
                    axesStates: [],
                    pressedStates: [],
                    releasedStates: [],
                },
            ]
            this.inputQueue = []
        },
        setInput(input) {
            const gp = this.activeGamepads[0]
            gp.buttonStates = input.buttonStates ?? []
            gp.axesStates = input.axesStates ?? []
            gp.pressedStates = input.pressedStates ?? []
            gp.releasedStates = input.releasedStates ?? []
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
        isSupported() {
            return true
        },
    })
}, 5)
