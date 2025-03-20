import { assert } from '../misc/assert'

declare global {
    namespace dummy {
        interface InputManager {
            input: ig.Input
            gamepadManager: ig.GamepadManager
            screen: Vec2
            player: dummy.DummyPlayer

            gatherInput(): ig.ENTITY.Player.PlayerInput | undefined
        }
    }
}

import './dummy-input-clone'
import './dummy-input-puppet'

let backupInput!: ig.Input
let backupGamepad!: ig.GamepadManager
let backupPlayer!: ig.ENTITY.Player
let backupScreen!: Vec2
let backupPlayerModel!: sc.PlayerModel

let applied: boolean = false
export function apply(inp: dummy.InputManager) {
    applied = true

    backupInput = ig.input
    backupGamepad = ig.gamepad
    backupPlayer = ig.game.playerEntity
    backupScreen = ig.game.screen
    backupPlayerModel = sc.model.player

    ig.input = inp.input
    ig.gamepad = inp.gamepadManager
    ig.game.playerEntity = inp.player
    ig.game.screen = inp.screen
    sc.model.player = inp.player.model
}

export function restore() {
    assert(applied)
    applied = false

    ig.input = backupInput
    ig.gamepad = backupGamepad
    ig.game.playerEntity = backupPlayer
    ig.game.screen = backupScreen
    sc.model.player = backupPlayerModel
}
