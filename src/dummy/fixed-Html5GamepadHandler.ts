import { assert } from '../misc/assert'

export function defaultGamepadButtonDeadzones() {
    const deadzones = [] as unknown as ig.Gamepad['buttonDeadzones']
    deadzones[ig.BUTTONS.LEFT_TRIGGER] = 30 / 255
    deadzones[ig.BUTTONS.RIGHT_TRIGGER] = 30 / 255
    return deadzones
}
export function defaultGamepadAxesDeadzones() {
    const deadzones = [] as unknown as ig.Gamepad['axesDeadzones']
    deadzones[ig.AXES.LEFT_STICK_X] = 7849 / 32767
    deadzones[ig.AXES.LEFT_STICK_Y] = 7849 / 32767
    deadzones[ig.AXES.RIGHT_STICK_X] = 8689 / 32767
    deadzones[ig.AXES.RIGHT_STICK_Y] = 8689 / 32767
    return deadzones
}

export const gamepadAxesDeadzones = []

export class Html5GamepadHandler {
    buttonMappings: Record<ig.BUTTONS, number> = {
        [ig.BUTTONS.FACE0]: 0,
        [ig.BUTTONS.FACE1]: 1,
        [ig.BUTTONS.FACE2]: 2,
        [ig.BUTTONS.FACE3]: 3,
        [ig.BUTTONS.LEFT_SHOULDER]: 4,
        [ig.BUTTONS.RIGHT_SHOULDER]: 5,
        [ig.BUTTONS.LEFT_TRIGGER]: 6,
        [ig.BUTTONS.RIGHT_TRIGGER]: 7,
        [ig.BUTTONS.SELECT]: 8,
        [ig.BUTTONS.START]: 9,
        [ig.BUTTONS.LEFT_STICK]: 10,
        [ig.BUTTONS.RIGHT_STICK]: 11,
        [ig.BUTTONS.DPAD_UP]: 12,
        [ig.BUTTONS.DPAD_DOWN]: 13,
        [ig.BUTTONS.DPAD_LEFT]: 14,
        [ig.BUTTONS.DPAD_RIGHT]: 15,
    }
    axesMappings: Record<ig.AXES, number> = {
        [ig.AXES.LEFT_STICK_X]: 0,
        [ig.AXES.LEFT_STICK_Y]: 1,
        [ig.AXES.RIGHT_STICK_X]: 2,
        [ig.AXES.RIGHT_STICK_Y]: 3,
    }

    constructor(
        public onConnect: (id: string) => void,
        public onDisconnect: (id: string) => void
    ) {}

    update(gamepads: Record<string, ig.Gamepad>) {
        const rawGamepads = navigator.getGamepads && navigator.getGamepads()
        assert(rawGamepads)

        for (let i = 0; i < rawGamepads.length; i++) {
            const rawGamepad = rawGamepads[i]
            const id = 'html5Pad' + i
            if (!rawGamepad) {
                if (gamepads[id]) {
                    this.onDisconnect(id)
                    delete gamepads[id]
                }
                continue
            }
            if (!gamepads[id]) {
                const gamepad = new ig.Gamepad()
                gamepad.axesDeadzones = defaultGamepadAxesDeadzones()
                gamepad.buttonDeadzones = defaultGamepadButtonDeadzones()
                gamepads[id] = gamepad
                this.onConnect(id)
            }
            const gamepad = gamepads[id]

            for (const buttonId of Object.keysT(this.buttonMappings)) {
                const button = rawGamepad.buttons[this.buttonMappings[buttonId]]
                if (button instanceof Object) gamepad.updateButton(buttonId, button.value)
                else gamepad.updateButton(buttonId, button)
            }

            for (const axesId of Object.keysT(this.axesMappings)) {
                const axes = rawGamepad.axes[this.axesMappings[axesId]]
                gamepad.updateAxes(axesId, axes)
            }
        }
    }
}
