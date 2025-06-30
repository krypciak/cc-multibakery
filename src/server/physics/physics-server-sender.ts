import { Client } from '../../client/client'
import { assert } from '../../misc/assert'
import { NetConnection } from '../../net/connection'
import { prestart } from '../../plugin'
import { getStateUpdatePacket } from '../../state/states'
import { CCMap } from '../ccmap'
import { PhysicsServer } from './physics-server'

prestart(() => {
    if (!PHYSICS) return
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof PhysicsServer && instanceinator.id == multi.server.serverInst.id) {
                send()
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
        if (!map?.inst) continue

        mapPackets[mapName] = getMapUpdatePacket(map, multi.server.sendMapFullState.has(mapName))
    }
    multi.server.sendMapFullState.clear()

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
    assert(multi.server instanceof PhysicsServer)

    const readyMaps = multi.server.connectionReadyMaps.get(conn)
    const sendMapPackets: PhysicsServerUpdatePacket['mapPackets'] = {}
    for (const client of conn.clients) {
        const mapName = client.player.mapName
        if (sendMapPackets[mapName] || !readyMaps || !readyMaps.has(mapName)) continue
        sendMapPackets[mapName] = mapPackets[mapName]
    }

    const data: PhysicsServerUpdatePacket = {
        mapPackets: sendMapPackets,
        tick: ig.system.tick,
        sendAt: Date.now(),
    }
    return data
}
