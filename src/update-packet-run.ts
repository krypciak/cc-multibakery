import { FromClientUpdatePacket, emptyGatherInput } from './api'
import { Player } from './player'

export function runUpdatePacket(player: Player, packet: FromClientUpdatePacket) {
    if (packet.element) {
        player.dummy.model.setElementMode(packet.element)
    }

    if (packet.paused) {
        player.dummy.input.clearPressed()
        player.dummy.nextGatherInput = emptyGatherInput()
    } else {
        if (packet.vars) {
            for (const { path, value } of packet.vars) {
                ig.vars.set(path, value)
            }
        }
        if (packet.input) {
            player.dummy.input.setInput(packet.input)
        }
        if (packet.gatherInput) {
            player.dummy.nextGatherInput = packet.gatherInput
        }
        if (packet.relativeCursorPos && player.dummy.crosshairController) {
            player.dummy.crosshairController.relativeCursorPos = packet.relativeCursorPos
        }
    }
}
