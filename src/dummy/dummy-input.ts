declare global {
    namespace dummy {
        type InputManager = dummy.input.Clone.InputManager
    }
}

import './dummy-input-clone'
import './dummy-input-puppet'

export function inputBackup<T>(inp: dummy.InputManager, task: () => T): T {
    const backupInput = ig.input
    const backupGamepad = ig.gamepad
    const backupPlayer = ig.game.playerEntity
    const backupScreen = ig.game.screen
    const backupPlayerModel = sc.model.player

    ig.input = inp.input
    ig.gamepad = inp.gamepadManager
    ig.game.playerEntity = inp.player
    ig.game.screen = inp.screen
    sc.model.player = inp.player.model

    const ret = task()

    ig.input = backupInput
    ig.gamepad = backupGamepad
    ig.game.playerEntity = backupPlayer
    ig.game.screen = backupScreen
    sc.model.player = backupPlayerModel

    return ret
}
