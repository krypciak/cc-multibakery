import { FromClientUpdatePacket } from './api'
import { Player } from './player'

export function runUpdatePacket(player: Player, packet: FromClientUpdatePacket) {
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
    if (packet.relativeCursorPos) {
        player.dummy.crosshairController.relativeCursorPos = packet.relativeCursorPos
    }
}
