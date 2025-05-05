import { assert } from '../misc/assert'
import { NetConnection } from '../net/connection'
import { prestart } from '../plugin'
import { getFullEntityState } from '../state/states'
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
    if (!multi.server.netManager) return
    const mapsToSend = new Set<string>()

    const connections = multi.server.netManager.connections
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
        conn.send('update', data)
    }
}

export interface CCMapUpdatePacket {
    entities: StateUpdatePacket
}
function getMapUpdatePacket(map: CCMap): CCMapUpdatePacket {
    const prevId = instanceinator.id
    map.inst.apply()

    const data: CCMapUpdatePacket = {
        entities: getFullEntityState(),
    }

    instanceinator.instances[prevId].apply()
    return data
}

export interface PhysicsServerUpdatePacket {
    mapPackets: Record</* mapName */ string, CCMapUpdatePacket>
    tick: number
    sendAt: number
}
function getRemoteServerUpdatePacket(
    conn: NetConnection,
    mapPackets: Record<string, CCMapUpdatePacket>
): PhysicsServerUpdatePacket {
    const sendMapPackets: PhysicsServerUpdatePacket['mapPackets'] = {}
    for (const client of conn.clients) {
        const mapName = client.player.mapName
        if (sendMapPackets[mapName]) continue
        sendMapPackets[mapName] = mapPackets[mapName]
    }

    const data: PhysicsServerUpdatePacket = {
        mapPackets: sendMapPackets,
        tick: ig.system.tick,
        sendAt: Date.now(),
    }
    return data
}
