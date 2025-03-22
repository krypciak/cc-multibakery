import { prestart } from '../plugin'
import { Html5GamepadHandler } from './fixed-Html5GamepadHandler'

declare global {
    namespace ig {
        interface Gamepad {
            onDisconnect?: () => void
        }
    }
}
class GamepadAssigner {
    private handler!: Html5GamepadHandler
    private gamepads: Record<string, ig.Gamepad> = {}

    private freeGamepads: string[] = []
    private requestsPromiseResolves: { instanceId: number; resolve: (gamepad: ig.Gamepad) => void }[] = []

    initialize() {
        if (!navigator.getGamepads) return

        const newId = (id: string) => {
            const gamepad = this.gamepads[id]
            if (this.requestsPromiseResolves.length > 0) {
                this.requestsPromiseResolves[0].resolve(gamepad)
                this.requestsPromiseResolves.splice(0, 1)
            } else {
                this.freeGamepads.push(id)
            }
        }
        this.handler = new Html5GamepadHandler(
            id => {
                const gamepad = this.gamepads[id]
                gamepad.destroy = async () => {
                    newId(id)
                }
                newId(id)
            },
            id => {
                const gamepad = this.gamepads[id]
                this.freeGamepads.erase(id)
                if (gamepad.onDisconnect) gamepad.onDisconnect()
            }
        )
    }

    onPreUpdate() {
        if (!this.handler) return
        this.handler.update(this.gamepads)
    }

    async requestGamepad(instanceId: number, onDisconnect: () => void): Promise<ig.Gamepad> {
        if (this.freeGamepads.length > 0) {
            const id = this.freeGamepads[0]
            this.freeGamepads.splice(0, 1)

            const gamepad = this.gamepads[id]
            gamepad.onDisconnect = onDisconnect
            return gamepad
        } else {
            return new Promise<ig.Gamepad>(res => {
                this.requestsPromiseResolves.push({
                    instanceId,
                    resolve: gamepad => {
                        gamepad.onDisconnect = onDisconnect
                        res(gamepad)
                    },
                })
                this.requestsPromiseResolves.sort((a, b) => a.instanceId - b.instanceId)
            })
        }
    }
}
declare global {
    namespace dummy.input.Clone {
        var gamepadAssigner: GamepadAssigner
    }
}
prestart(() => {
    dummy.input.Clone.gamepadAssigner = new GamepadAssigner()
    /* initiaize needs to be called in local-server.ts */
})

declare global {
    namespace dummy.input.Clone {
        interface SingleGamepadManager extends ig.GamepadManager {
            setSingleGamepad(this: this, gamepad: ig.Gamepad): void
            clearSingleGamepad(this: this): void
        }
        interface SingleGamepadManagerConstructor extends ImpactClass<SingleGamepadManager> {
            new (): SingleGamepadManager
        }
        var SingleGamepadManager: SingleGamepadManagerConstructor
    }
}
prestart(() => {
    dummy.input.Clone.SingleGamepadManager = ig.GamepadManager.extend({
        init() {
            this.activeGamepads = []
            this.clearSingleGamepad()
        },
        onPreUpdate() {
            if (this.isLeftStickDown() || this.isRightStickDown()) {
                ig.input.mouseGuiActive = false
                ig.input.currentDevice = ig.INPUT_DEVICES.GAMEPAD
            }
        },
        setSingleGamepad(gamepad) {
            this.activeGamepads = [gamepad]
        },
        clearSingleGamepad() {
            this.activeGamepads = []
        },
        isSupported() {
            return true
        },
    })
}, 3)

declare global {
    namespace ig {
        interface GamepadManager {
            destroy(this: this): Promise<void>
        }
        interface Gamepad {
            destroy?(this: this): Promise<void>
        }
    }
}
prestart(() => {
    ig.GamepadManager.inject({
        destroy() {
            return Promise.all(
                this.activeGamepads.map(gamepad => gamepad.destroy && gamepad.destroy())
            ) as unknown as Promise<void>
        },
    })
})
