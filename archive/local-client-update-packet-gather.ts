import { FromClientUpdatePacket } from './api'
import { getDummyUpdateGamepadInputFromIgGamepadManager, getDummyUpdateKeyboardInputFromIgInput } from './dummy-player'
import { assert } from './misc/assert'
import { prestart } from './plugin'

let state: FromClientUpdatePacket

prestart(() => {
    sc.PlayerModel.inject({
        setElementMode(element, force, skipEffect) {
            if (multi.server) return this.parent(element, force, skipEffect)

            if (multi.client.isExecutingUpdatePacketNow || this !== sc.model.player) {
                return this.parent(element, force, skipEffect)
            } else if (this === sc.model.player) {
                state.element = element
            }
            return false
        },
    })
})

function input() {
    if (!ig?.input) return
    assert(state.paused)

    state.input = getDummyUpdateKeyboardInputFromIgInput(ig.input)
}
function gamepadInput() {
    if (!ig?.gamepad) return
    assert(state.paused)

    state.gamepadInput = getDummyUpdateGamepadInputFromIgGamepadManager(ig.gamepad)
}
function gatherInput() {
    assert(state.paused)
    if (!ig.game?.playerEntity) return

    state.gatherInput = ig.ENTITY.Player.prototype.gatherInput.bind(ig.game.playerEntity)()
}
function relativeCursorPos() {
    assert(state.paused)
    state.relativeCursorPos = { x: 0, y: 0 }
    state.gatherInput = ig.game?.playerEntity?.gatherInput()
    ig.system?.getMapFromScreenPos(state.relativeCursorPos, sc.control.getMouseX(), sc.control.getMouseY())
}

function reset() {
    state = {
        type: 'ig.dummy.DummyPlayer',
    }
}

export function popLocalUpdatePacket(): FromClientUpdatePacket {
    if (!ig.game?.pausedVirtual && !ig.loading && ig.ready && sc.model.isGame()) {
        relativeCursorPos()
        gatherInput()
        input()
        gamepadInput()
    } else {
        state.paused = true
    }
    const ret = state
    reset()
    return ret
}
