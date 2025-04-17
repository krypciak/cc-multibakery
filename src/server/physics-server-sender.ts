import { assert } from '../misc/assert'
import { NetConnection } from '../net/connection'
import { prestart } from '../plugin'
import { EntityStateUpdatePacketRecord, getFullEntityState } from '../state/states'
import { CCMap } from './ccmap'
import { PhysicsServer } from './physics-server'

let i = -1
prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof PhysicsServer && instanceinator.id == multi.server.serverInst.id) {
                if (i++ % 1 == 0) send()
            }
        },
    })
})

function send() {
    assert(multi.server instanceof PhysicsServer)
    const mapsToSend = new Set<string>()

    const connections = multi.server.netManager!.connections
    for (const conn of connections) {
        for (const client of conn.clients) {
            mapsToSend.add(client.player.mapName)
        }
    }

    const mapPackets: Record<string, CCMapUpdatePacket> = {}

    for (const mapName of mapsToSend) {
        const map = multi.server.maps[mapName]
        if (!map.inst) continue
        mapPackets[mapName] = getMapUpdatePacket(map)
    }

    for (const conn of connections) {
        const data = getRemoteServerUpdatePacket(conn, mapPackets)
        conn.sendUpdate(data)
    }
}

export interface CCMapUpdatePacket {
    entities: EntityStateUpdatePacketRecord
}
function getMapUpdatePacket(map: CCMap): CCMapUpdatePacket {
    const data: CCMapUpdatePacket = {
        entities: getFullEntityState(map.inst.ig.game.entities),
    }
    return data
}

export interface RemoteServerUpdatePacket {
    mapPackets: Record</* mapName */ string, CCMapUpdatePacket>
}
function getRemoteServerUpdatePacket(
    conn: NetConnection,
    mapPackets: Record<string, CCMapUpdatePacket>
): RemoteServerUpdatePacket {
    const sendMapPackets: RemoteServerUpdatePacket['mapPackets'] = {}
    for (const client of conn.clients) {
        const mapName = client.player.mapName
        if (sendMapPackets[mapName]) continue
        sendMapPackets[mapName] = mapPackets[mapName]
    }

    const data: RemoteServerUpdatePacket = {
        mapPackets: sendMapPackets,
    }
    return data
}
