import { Client } from '../../client/client'
import { assert } from '../../misc/assert'
import { NetConnection } from '../../net/connection'
import { prestart } from '../../plugin'
import { getStateUpdatePacket } from '../../state/states'
import { CCMap } from '../ccmap'
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
    const mapsToSend: Record<string, Client[]> = {}

    const connections = multi.server.netManager.connections
    for (const conn of connections) {
        for (const client of conn.clients) {
            ;(mapsToSend[client.player.mapName] ??= []).push(client)
        }
    }

    const mapPackets: Record<string, StateUpdatePacket> = {}

    for (const mapName in mapsToSend) {
        const map = multi.server.maps[mapName]
        if (!map.inst) continue

        const clients = mapsToSend[mapName]
        const shoudSendFullState = clients.some(client => client.shouldSendFullState)
        for (const client of clients) client.shouldSendFullState = false

        mapPackets[mapName] = getMapUpdatePacket(map, shoudSendFullState)
    }

    for (const conn of connections) {
        const data = getRemoteServerUpdatePacket(conn, mapPackets)
        conn.send('update', data)
    }
}

function getMapUpdatePacket(map: CCMap, shoudSendFullState: boolean): StateUpdatePacket {
    const prevId = instanceinator.id
    map.inst.apply()

    const packet = getStateUpdatePacket(shoudSendFullState)

    instanceinator.instances[prevId].apply()
    return packet
}

export interface PhysicsServerUpdatePacket {
    mapPackets: Record</* mapName */ string, StateUpdatePacket>
    tick: number
    sendAt: number
}
function getRemoteServerUpdatePacket(
    conn: NetConnection,
    mapPackets: Record<string, StateUpdatePacket>
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
