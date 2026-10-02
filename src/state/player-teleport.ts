import type { GlobalStateHandler } from './global-state-handlers'
import { assertRemote } from '../server/remote/remote-server-types'
import type { Username } from '../net/binary/binary-types'
import type { MapTpInfo } from '../server/server-types'
import type { EntityNetid } from '../misc/entity-netid'

declare global {
    interface GlobalStateUpdatePacket {
        playerTeleport?: Record<Username, TeleportInfoEntry>
    }
}

interface TeleportInfoEntry {
    netid: EntityNetid
    tpInfo: MapTpInfo
    noBlackout: boolean
    color: { r: number; g: number; b: number; lighter: boolean; timeIn: number; timeOut: number }
}

let playerTeleports: Record<Username, TeleportInfoEntry> = {}

export const playerTeleportGlobalStateHandler: GlobalStateHandler = {
    get(packet, conn) {
        if (packet.playerTeleport) return
        const matching = Object.entries(playerTeleports).filter(([username]) =>
            conn.clients.some(c => c.username == username)
        )
        if (matching.length > 0) {
            packet.playerTeleport = Object.fromEntries(matching)
        }
    },
    clear() {
        playerTeleports = {}
    },
    set(packet) {
        if (!packet.playerTeleport) return

        assertRemote(multi.server)
        for (const username in packet.playerTeleport) {
            const { tpInfo, netid, color, noBlackout } = packet.playerTeleport[username]
            const client = multi.server.clients.get(username)
            if (!client?.ready) continue
            client.reservedNetid = netid
            Object.assign(client.inst.ig.game.teleportColor, color)
            client.teleportOverrides.noBlackout = noBlackout
            client.teleport(tpInfo)
        }
    },
}

export function notifyRemoteAboutTeleport(username: Username, entry: TeleportInfoEntry) {
    playerTeleports[username] = entry
}
