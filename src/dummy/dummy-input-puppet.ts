import type { u24 } from 'ts-binarifier/src/type-aliases'
import { prestart } from '../loading-stages'
import type { InputSequenceNumber } from '../server/player-input-latency'
import { cleanRecord, StateMemory } from '../state/state-util'
import { InputManagerBlock } from './dummy-input-clone'
import { defaultGamepadAxesDeadzones, defaultGamepadButtonDeadzones } from './fixed-Html5GamepadHandler'

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

/* ig.Input */
export const disallowedInputActions: ig.Input.KnownAction[] = ['snapshot', 'savedialog', 'langedit', 'fullscreen']

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

            getInput(this: this): InputDataPacket | undefined
        }
    }
}

export interface InputData {
    currentDevice?: ig.INPUT_DEVICES
    isUsingMouse?: boolean
    isUsingKeyboard?: boolean
    ignoreKeyboard?: boolean
    mouseGuiActive?: boolean
    mouse?: Vec2
    keyups?: ig.Input['keyups']
    presses?: ig.Input['presses']
    locks?: ig.Input['locks']
    actions?: ig.Input['actions']
}
export interface InputDataPacket extends InputData {
    sequenceNumbers?: u24[]
}

function getInput(this: ig.Input): InputDataPacket | undefined {
    const memory = (this.memory = StateMemory.get(this.memory))

    let sequenceNumbers = PROFILE
        ? Object.entries(this.inputSequenceNumbers)
              .filter(([_seq, e]) => e.stage == 'notYetSent')
              .map(([seq]) => Number(seq) as InputSequenceNumber)
        : undefined
    if (sequenceNumbers?.length == 0) sequenceNumbers = undefined

    const input: InputDataPacket | undefined = cleanRecord({
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

        sequenceNumbers,
    })
    if (!input) return

    for (const action of disallowedInputActions) {
        delete input.presses?.[action]
        delete input.actions?.[action]
    }
    return input
}

function setInput(on: InputData, input: InputData) {
    if (!input) return

    if (input.currentDevice !== undefined) on.currentDevice = input.currentDevice
    if (input.isUsingMouse !== undefined) on.isUsingMouse = input.isUsingMouse
    if (input.isUsingKeyboard !== undefined) on.isUsingKeyboard = input.isUsingKeyboard
    if (input.ignoreKeyboard !== undefined) on.ignoreKeyboard = input.ignoreKeyboard
    if (input.mouseGuiActive !== undefined) on.mouseGuiActive = input.mouseGuiActive
    if (input.mouse !== undefined) Vec2.assign((on.mouse ??= Vec2.create()), input.mouse)

    StateMemory.applyChangeRecord((on.presses ??= {}), input.presses)
    StateMemory.applyChangeRecord((on.keyups ??= {}), input.keyups)
    StateMemory.applyChangeRecord((on.locks ??= {}), input.locks)
    StateMemory.applyChangeRecord((on.actions ??= {}), input.actions)
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
            inputQueue: InputDataPacket[]

            pushInput(this: this, input: InputDataPacket): void
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
        pushInput(input) {
            this.inputQueue.push(input)
        },
        popInput() {
            const input = this.inputQueue.shift()
            if (!input) return
            setInput(this, input)
        },
        clearPressed() {},
    })
}, 5)

/* ig.GamepadManager */
declare global {
    namespace ig {
        interface GamepadManager {
            memory?: StateMemory

            getInput(this: this): GamepadInputData | undefined
        }
    }
}

export interface GamepadInputData {
    axesStates?: number[]
    buttonStates?: number[]
    pressedStates?: boolean[]
    releasedStates?: boolean[]
}

function getGamepadInput(this: ig.GamepadManager): GamepadInputData | undefined {
    const gp = this.activeGamepads[0]
    if (!gp) return

    const memory = (this.memory = StateMemory.get(this.memory))

    const packet: GamepadInputData | undefined = cleanRecord({
        axesStates: memory.diffArray(gp.axesStates),
        buttonStates: memory.diffArray(gp.buttonStates),
        pressedStates: memory.diffArray(gp.pressedStates),
        releasedStates: memory.diffArray(gp.releasedStates),
    })
    return packet
}

function setGamepadInput(gp: GamepadInputData, input: GamepadInputData) {
    if (!input) return
    if (input.buttonStates) gp.buttonStates = input.buttonStates
    if (input.axesStates) gp.axesStates = input.axesStates
    if (input.pressedStates) gp.pressedStates = input.pressedStates
    if (input.releasedStates) gp.releasedStates = input.releasedStates
}

prestart(() => {
    ig.GamepadManager.inject({ getInput: getGamepadInput })
})

export function isGamepadManagerData(_data: unknown): _data is GamepadInputData {
    const data = _data as GamepadInputData
    if (typeof data != 'object') return false

    if (data.buttonStates && typeof data.buttonStates != 'object') return false
    if (data.axesStates && typeof data.axesStates != 'object') return false
    if (data.pressedStates && typeof data.pressedStates != 'object') return false
    if (data.releasedStates && typeof data.releasedStates != 'object') return false

    return true
}

const emptyGamepadStates = new Array(16).fill(null).map(_ => false)
function getEmptyGamepad(): ig.Gamepad {
    // prettier-ignore
    return {
        buttonDeadzones: defaultGamepadButtonDeadzones(),
        axesDeadzones: defaultGamepadAxesDeadzones(),
        buttonStates: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        axesStates: [0, 0, 0, 0],
        pressedStates: [...emptyGamepadStates],
        releasedStates: [...emptyGamepadStates],
    } satisfies Partial<ig.Gamepad> as ig.Gamepad
}

declare global {
    namespace dummy.input.Puppet {
        interface GamepadManager extends ig.GamepadManager {
            inputQueue: GamepadInputData[]

            pushInput(this: this, input: GamepadInputData): void
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
        pushInput(input) {
            this.inputQueue.push(input)
        },
        popInput() {
            const input = this.inputQueue.shift()

            const gp = this.activeGamepads[0]

            for (let i = 0; i < 16; i++) {
                gp.pressedStates[i] = false
                gp.releasedStates[i] = false
            }

            if (!input) return
            setGamepadInput(gp, input)
        },
        isSupported() {
            return true
        },
    })
}, 5)
