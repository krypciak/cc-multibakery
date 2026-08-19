import type { GlobalStateHandler } from './global-state-handlers'
import { isRemote } from '../server/remote/remote-server-types'
import { assert } from '../misc/assert'
import type { Username } from '../net/binary/binary-types'
import type { MapTpInfo } from '../server/server-types'
import type { EntityNetid } from '../misc/entity-netid'

declare global {
    interface GlobalStateUpdatePacket {
        playerTeleport?: Record<
            Username,
            {
                netid: EntityNetid
                tpInfo: MapTpInfo
            }
        >
    }
}

let playerTeleports: Record<
    Username,
    {
        netid: EntityNetid
        tpInfo: MapTpInfo
    }
> = {}

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

        assert(isRemote(multi.server))
        for (const username in packet.playerTeleport) {
            const { tpInfo, netid } = packet.playerTeleport[username]
            const client = multi.server.clients.get(username)
            if (!client?.ready) continue
            client.reservedNetid = netid
            client.teleport(tpInfo)
        }
    },
}

export function notifyRemoteAboutTeleport(username: Username, netid: EntityNetid, tpInfo: MapTpInfo) {
    playerTeleports[username] = {
        netid,
        tpInfo,
    }
}
