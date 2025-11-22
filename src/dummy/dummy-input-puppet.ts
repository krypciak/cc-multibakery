import { prestart } from '../loading-stages'
import { cleanRecord, StateMemory } from '../state/state-util'
import { InputManagerBlock } from './dummy-input-clone'
import { defaultGamepadAxesDeadzones, defaultGamepadButtonDeadzones } from './fixed-Html5GamepadHandler'

export type InputData = ReturnType<typeof getInput>

export type GamepadManagerData = ReturnType<typeof getGamepadInput>

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
            memory?: StateMemory

            getInput(this: this): InputData
        }
    }
}

function getInput(this: ig.Input) {
    const memory = (this.memory = StateMemory.get(this.memory))

    return cleanRecord({
        currentDevice: memory.diff(this.currentDevice),

        isUsingMouse: memory.diff(this.isUsingMouse),
        isUsingKeyboard: memory.diff(this.isUsingKeyboard),
        ignoreKeyboard: memory.diff(this.ignoreKeyboard),
        mouseGuiActive: memory.diff(this.mouseGuiActive),
        mouse: memory.diffVec2(this.mouse),
        keyups: memory.diffRecord(this.keyups),
        presses: memory.diffRecord(this.presses),
        locks: memory.diffRecord(this.locks),
        actions: memory.diffRecord(this.actions),
    })
}

prestart(() => {
    ig.Input.inject({
        getInput,
        clearPressed() {
            const pressesBackup = this.presses
            const keyupsBackup = this.keyups
            this.parent()

            this.presses = pressesBackup
            for (const key in this.presses) this.presses[key as ig.Input.KnownAction] = false
            this.keyups = keyupsBackup
            for (const key in this.keyups) this.keyups[key as ig.Input.KnownAction] = false
        },
    })
}, 1)

declare global {
    namespace dummy.input.Puppet {
        interface Input extends ig.Input {
            inputQueue: InputData[]

            setInput(this: this, input: InputData | undefined): void
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
            if (!input) return

            if (input.currentDevice !== undefined) this.currentDevice = input.currentDevice
            if (input.isUsingMouse !== undefined) this.isUsingMouse = input.isUsingMouse
            if (input.isUsingKeyboard !== undefined) this.isUsingKeyboard = input.isUsingKeyboard
            if (input.ignoreKeyboard !== undefined) this.ignoreKeyboard = input.ignoreKeyboard
            if (input.mouseGuiActive !== undefined) this.mouseGuiActive = input.mouseGuiActive
            if (input.mouse !== undefined) Vec2.assign(this.mouse, input.mouse)

            StateMemory.applyChangeRecord(this.presses, input.presses)
            StateMemory.applyChangeRecord(this.keyups, input.keyups)
            StateMemory.applyChangeRecord(this.locks, input.locks)
            StateMemory.applyChangeRecord(this.actions, input.actions)
        },
        pushInput(input) {
            this.inputQueue.push(input)
        },
        popInput() {
            const input = this.inputQueue.shift()
            this.setInput(input)
        },
        clearPressed() {},
    })
}, 5)

declare global {
    namespace ig {
        interface GamepadManager {
            memory?: StateMemory

            getInput(this: this): GamepadManagerData | undefined
        }
    }
}
function getGamepadInput(this: ig.GamepadManager) {
    const gp = this.activeGamepads[0]
    if (!gp) return

    const memory = (this.memory = StateMemory.get(this.memory))

    const packet = cleanRecord({
        axesStates: memory.diffArray(gp.axesStates),
        buttonStates: memory.diffArray(gp.buttonStates),
        pressedStates: memory.diffArray(gp.pressedStates),
        releasedStates: memory.diffArray(gp.releasedStates),
    })
    return packet
}
prestart(() => {
    ig.GamepadManager.inject({ getInput: getGamepadInput })
})

export function isGamepadManagerData(_data: unknown): _data is GamepadManagerData {
    const data = _data as GamepadManagerData
    if (typeof data != 'object') return false

    if (data.buttonStates && typeof data.buttonStates != 'object') return false
    if (data.axesStates && typeof data.axesStates != 'object') return false
    if (data.pressedStates && typeof data.pressedStates != 'object') return false
    if (data.releasedStates && typeof data.releasedStates != 'object') return false

    return true
}

function getEmptyGamepad(): ig.Gamepad {
    // prettier-ignore
    return {
        buttonDeadzones: defaultGamepadButtonDeadzones(),
        axesDeadzones: defaultGamepadAxesDeadzones(),
        buttonStates: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        axesStates: [0, 0, 0, 0],
        pressedStates: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        releasedStates: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    } satisfies Partial<ig.Gamepad> as ig.Gamepad
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
            this.activeGamepads = [getEmptyGamepad()]
            this.inputQueue = []
        },
        setInput(input) {
            const gp = this.activeGamepads[0]
            for (let i = 0; i < 16; i++) {
                gp.pressedStates[i] = false
                gp.releasedStates[i] = false
            }

            if (!input) return
            if (input.buttonStates) gp.buttonStates = input.buttonStates
            if (input.axesStates) gp.axesStates = input.axesStates
            if (input.pressedStates) gp.pressedStates = input.pressedStates
            if (input.releasedStates) gp.releasedStates = input.releasedStates
        },
        pushInput(input) {
            this.inputQueue.push(input)
        },
        popInput() {
            const input = this.inputQueue.shift()
            this.setInput(input)
        },
        isSupported() {
            return true
        },
    })
}, 5)
