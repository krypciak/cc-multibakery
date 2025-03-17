export {}
declare global {
    namespace dummy {
        let DummyInputManagerPuppet: typeof DummyInputManagerPuppetClazz
    }
}
class DummyInputManagerPuppetClazz implements dummy.InputManager {
    input!: ig.Input
    gamepadManager!: dummy.GamepadManager
    constructor() {}
    gatherInput() {
        return undefined
    }
}
dummy.DummyInputManagerPuppet = DummyInputManagerPuppetClazz
