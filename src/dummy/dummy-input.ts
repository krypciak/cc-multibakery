import { assert } from '../misc/assert'

declare global {
    namespace dummy {
        type InputManager = dummy.input.Clone.InputManager
    }
}

import './dummy-input-clone'
import './dummy-input-puppet'

let backupInput!: ig.Input
let backupGamepad!: ig.GamepadManager
let backupPlayer!: ig.ENTITY.Player
let backupScreen!: Vec2
let backupPlayerModel!: sc.PlayerModel

let appliedTimes = 0
let inpApplied: dummy.InputManager | undefined
export function apply(inp: dummy.InputManager) {
    appliedTimes++
    if (inpApplied == inp) return
    else assert(appliedTimes == 1)
    inpApplied = inp

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
    assert(appliedTimes > 0)
    appliedTimes--
    if (appliedTimes > 0) return
    inpApplied = undefined

    ig.input = backupInput
    ig.gamepad = backupGamepad
    ig.game.playerEntity = backupPlayer
    ig.game.screen = backupScreen
    sc.model.player = backupPlayerModel
}
