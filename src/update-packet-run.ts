import { FromClientUpdatePacket } from './api'
import { Player } from './player'

export function runUpdatePacket(_player: Player, packet: FromClientUpdatePacket) {
    if (packet.vars) {
        for (const { path, value } of packet.vars) {
            ig.vars.set(path, value)
        }
    }
}
