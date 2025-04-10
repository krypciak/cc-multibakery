export interface DummyUpdateInput {
    isUsingMouse: boolean
    isUsingKeyboard: boolean
    isUsingAccelerometer: boolean
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

export interface DummyUpdateGamepadInput {
    buttonDeadzones: Record<ig.BUTTONS, number>
    axesDeadzones: Record<ig.BUTTONS, number>
    buttonStates: Record<ig.BUTTONS, number>
    axesStates: Record<ig.BUTTONS, number>
    pressedStates: Record<ig.BUTTONS, boolean>
    releasedStates: Record<ig.BUTTONS, boolean>
}
