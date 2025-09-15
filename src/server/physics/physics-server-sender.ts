import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import { clearCollectedState, getStateUpdatePacket, StateKey } from '../../state/states'
import { CCMap } from '../ccmap/ccmap'
import { PhysicsServer } from './physics-server'
import { NetConnection } from '../../net/connection'
import { cleanRecord } from '../../state/state-util'
import { PhysicsStatePacketEncoderDecoder } from '../../net/binary/physics-state-packet-encoder-decoder.generated'

export function sendPhysicsServerPacket() {
    assert(multi.server instanceof PhysicsServer)
    if (!multi.server.netManager) return

    const connections = multi.server.netManager.connections

    const packets: Record</* mapName */ string, Map<NetConnection, StateUpdatePacket>> = {}
    for (const conn of connections) {
        const readyMaps = multi.server.connectionReadyMaps.get(conn)

        for (const client of conn.clients) {
            const mapName = client.mapName
            const map = multi.server.maps.get(mapName)
            if (!map?.inst || !readyMaps || !readyMaps.has(mapName)) continue

            packets[mapName] ??= new Map()
            const cachePacket = packets[mapName].values().next()?.value
            let dest = packets[mapName].get(conn)
            if (!dest) {
                dest = {}
                packets[mapName].set(conn, dest)
            }

            getMapUpdatePacket(map, dest, client, cachePacket)
        }

        const connPackets: Record</* mapName */ string, StateUpdatePacket> = {}
        for (const mapName in packets) {
            const map = packets[mapName]
            const packet = map.get(conn)
            const cleanPacket = packet && cleanRecord(packet)
            if (cleanPacket) {
                connPackets[mapName] = cleanPacket
            }
        }

        const data = getRemoteServerUpdatePacket(connPackets, conn)
        const bin = PhysicsStatePacketEncoderDecoder.encode(data)
        conn.send('update', bin)
    }

    runTasks(
        [...multi.server.maps.values()].map(map => map.inst),
        () => {
            clearCollectedState()
        }
    )
}

function getMapUpdatePacket(map: CCMap, dest?: StateUpdatePacket, key?: StateKey, cache?: StateUpdatePacket) {
    runTask(map.inst, () => getStateUpdatePacket(dest, key, cache))
}

type PlayerMapChangeRecord = Record</* mapName*/ string, /* username */ string[]>
export interface PhysicsServerUpdatePacket {
    mapPackets?: Record</* mapName */ string, StateUpdatePacket>
    tick: number
    sendAt: number
    playerMaps?: PlayerMapChangeRecord
}
function getRemoteServerUpdatePacket(
    mapPackets: Record<string, StateUpdatePacket>,
    conn: NetConnection
): PhysicsServerUpdatePacket {
    const maps = conn.clients.reduce((acc, client) => {
        if (client.justTeleported) {
            client.justTeleported = false
            ;(acc[client.mapName] ??= []).push(client.username)
        }
        return acc
    }, {} as PlayerMapChangeRecord)

    const data: PhysicsServerUpdatePacket = {
        mapPackets: Object.keys(mapPackets).length > 0 ? mapPackets : undefined,
        tick: ig.system.tick,
        sendAt: Date.now(),
        playerMaps: cleanRecord(maps),
    }
    return data
}

export type GenerateType = PhysicsServerUpdatePacket
