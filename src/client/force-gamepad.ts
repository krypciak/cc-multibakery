import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import type { Client } from './client'

function getGamepadManager(client: Client) {
    const gamepadManager = client.inst.ig.gamepad
    assert(gamepadManager instanceof multi.class.SingleGamepadManager)
    return gamepadManager
}

function clearGamepad(client: Client, startWait: boolean) {
    getGamepadManager(client).clearSingleGamepad()
    client.inst.ig.input.currentDevice = ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE

    if (client.inputManager.inputType == ig.INPUT_DEVICES.GAMEPAD && startWait) {
        waitForGamepad(client)
    }
}

function waitForGamepad(client: Client) {
    runTask(client.inst, () => {
        sc.inputForcer.setEntry('WAIT_FOR_GAMEPAD', 'Waiting for gamepad', ' ', ' ')
    })
    multi.class.gamepadAssigner
        .requestGamepad(client.inst.id, () => {
            clearGamepad(client, true)
        })
        .then(gamepad => {
            getGamepadManager(client).setSingleGamepad(gamepad)
        })
}

export function forceGamepad(client: Client) {
    clearGamepad(client, true)
}

export function clearForceGamepad(client: Client) {
    runTask(client.inst, () => {
        ig.gamepad.activeGamepads[0]?.destroy?.()
        sc.inputForcer.clearEntry()
        clearGamepad(client, false)
    })
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
