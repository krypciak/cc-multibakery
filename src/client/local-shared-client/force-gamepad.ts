import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { waitForScheduledTask } from '../../server/local-server'
import { LocalSharedClient } from './local-shared-client'

export function forceGamepad(client: LocalSharedClient) {
    const input = client.player.inputManager
    const gamepadManager = client.inst.ig.gamepad
    if (!(input instanceof dummy.input.Clone.InputManager)) return
    assert(gamepadManager instanceof dummy.input.Clone.SingleGamepadManager)

    const clearGamepad = () => {
        gamepadManager.clearSingleGamepad()
        client.inst.ig.input.currentDevice = ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
        waitForGamepad()
    }
    const waitForGamepad = () => {
        waitForScheduledTask(client.inst, () => {
            sc.inputForcer.setEntry('WAIT_FOR_GAMEPAD', 'Waiting for gamepad', ' ', ' ')
        })
        dummy.input.Clone.gamepadAssigner
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
