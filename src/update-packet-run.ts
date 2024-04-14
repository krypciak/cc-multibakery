import { FromClientUpdatePacket, emptyGatherInput } from './api'
import { Player } from './player'

export function runUpdatePacket(player: Player, packet: FromClientUpdatePacket) {
    if (packet.paused) {
        player.dummy.input.clearPressed()
        player.dummy.nextGatherInput = emptyGatherInput()
    }
    /* dont allow the client to send an arbitrary position */
    packet.pos = undefined
    player.dummy.setState(packet)
}
