import { prestart } from '../loading-stages'
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
        this.clearAllState()

        const newId = (id: string) => {
            const gamepad = this.gamepads[id]
            if (this.requestsPromiseResolves.length > 0) {
                this.requestsPromiseResolves[0].resolve(gamepad)
                this.requestsPromiseResolves.shift()
            } else {
                this.freeGamepads.push(id)
            }
        }
        this.handler = new Html5GamepadHandler(
            id => {
                const gamepad = this.gamepads[id]
                gamepad.destroy = () => {
                    newId(id)
                }
                newId(id)
            },
            id => {
                const gamepad = this.gamepads[id]
                this.freeGamepads.erase(id)
                gamepad.onDisconnect?.()
            }
        )
    }

    update() {
        if (!this.handler) return
        this.handler.update(this.gamepads)
    }

    async requestGamepad(instanceId: number, onDisconnect: () => void): Promise<ig.Gamepad> {
        console.log('request number for', instanceId, 'free gamepads:', this.freeGamepads.length)
        if (this.freeGamepads.length > 0) {
            const id = this.freeGamepads[0]
            this.freeGamepads.shift()

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

    clearAllState() {
        this.freeGamepads = []
        this.requestsPromiseResolves = []
        this.gamepads = {}
        this.handler = undefined as any
    }
}
declare global {
    namespace multi.class {
        var gamepadAssigner: GamepadAssigner
    }
}
prestart(() => {
    multi.class.gamepadAssigner = new GamepadAssigner()
    /* initiaize needs to be called in server.ts */
})

declare global {
    namespace multi.class {
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
    multi.class.SingleGamepadManager = ig.GamepadManager.extend({
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
            destroy(this: this): void
        }
        interface Gamepad {
            destroy?(this: this): void
        }
    }
}
prestart(() => {
    ig.GamepadManager.inject({
        destroy() {
            for (const gamepad of this.activeGamepads) gamepad.destroy?.()
        },
    })
})
