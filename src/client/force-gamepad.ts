import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { waitForScheduledTask } from '../server/local-server'
import { Client } from './client'

export function forceGamepad(client: Client) {
    const input = client.player.inputManager
    if (!(input instanceof dummy.input.Clone.InputManager)) return

    const gamepadManager = client.inst.ig.gamepad
    assert(gamepadManager instanceof multi.class.SingleGamepadManager)

    const clearGamepad = () => {
        gamepadManager.clearSingleGamepad()
        client.inst.ig.input.currentDevice = ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
        waitForGamepad()
    }
    const waitForGamepad = () => {
        waitForScheduledTask(client.inst, () => {
            sc.inputForcer.setEntry('WAIT_FOR_GAMEPAD', 'Waiting for gamepad', ' ', ' ')
        })
        multi.class.gamepadAssigner
            .requestGamepad(client.inst.id, () => {
                clearGamepad()
            })
            .then(gamepad => {
                gamepadManager.setSingleGamepad(gamepad)
            })
    }
    clearGamepad()
}

declare global {
    namespace sc {
        interface INPUT_FORCER_ENTRIES {
            WAIT_FOR_GAMEPAD: sc.InputForcer.Entry
        }
    }
}
prestart(() => {
    sc.INPUT_FORCER_ENTRIES.WAIT_FOR_GAMEPAD = {
        cancelAction: true,
        keep: false,
        check() {
            return ig.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD
        },
    }
})
