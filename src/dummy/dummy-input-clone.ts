import { prestart } from '../plugin'

class InputManagerClazz implements dummy.InputManager {
    player!: dummy.DummyPlayer
    input: ig.Input
    gamepadManager: dummy.inputManagers.Clone.GamepadManager
    screen: Vec2 = { x: 0, y: 0 }

    constructor(realInput: ig.Input) {
        this.input = realInput
        this.patchInput()
        this.gamepadManager = new dummy.inputManagers.Clone.GamepadManager()
    }

    gatherInput() {
        /* to fix mouse melee */
        // const backupAttacking = sc.control.attacking
        // sc.control.attacking = function (this: sc.Control) {
        //     if (this.autoControl) return this.autoControl.get('attacking')
        //     return (
        //         (self.input.pressed('aim') && b() < sc.ATTACK_INPUT_DISTANCE) ||
        //         (!self.gamepadManager.isRightStickDown() &&
        //             self.gamepadManager.isButtonPressed(this._getAttackButton()))
        //     )
        // }.bind(sc.control)

        const ret = ig.ENTITY.Player.prototype.gatherInput.call(this.player)

        // sc.control.attacking = backupAttacking

        return ret
    }

    private patchInput() {}
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
