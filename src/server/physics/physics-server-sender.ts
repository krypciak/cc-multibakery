import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { clearCollectedState, getStateUpdatePacket, type StateKey } from '../../state/states'
import { CCMap } from '../ccmap/ccmap'
import { type NetConnection } from '../../net/connection'
import { cleanRecord } from '../../state/state-util'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'
import { type f64 } from 'ts-binarifier/src/type-aliases'
import { type MapTpInfo } from '../server'
import { type MapName, type Username } from '../../net/binary/binary-types'
import { assertPhysics } from './is-physics-server'

declare global {
    interface StateUpdatePacket {
        crash?: {
            tryReconnect: boolean
        }
    }
}

export function sendPhysicsServerPacket() {
    assertPhysics(multi.server)
    if (!multi.server.netManager) return

    const connections = multi.server.netManager.connections

    const packets: Record<MapName, Map<NetConnection, StateUpdatePacket>> = {}
    for (const conn of connections) {
        const readyMaps = multi.server.connectionReadyMaps.get(conn)

        for (const client of [...conn.clients]) {
            const mapName = client.tpInfo.map
            const map = multi.server.maps.get(mapName)

            packets[mapName] ??= new Map()
            const cachePacket = packets[mapName].values().next()?.value
            let dest = packets[mapName].get(conn)
            if (!dest) {
                dest = {}
                packets[mapName].set(conn, dest)
            }

            if (!map && client.destroyed) {
                dest.crash = { tryReconnect: true }
                conn.leave(client)
                continue
            }

            if (!map?.inst || !readyMaps || !readyMaps.has(mapName)) continue
            getMapUpdatePacket(map, dest, client, cachePacket)
        }

        const connPackets: Record<MapName, StateUpdatePacket> = {}
        for (const mapName in packets) {
            const map = packets[mapName]
            const packet = map.get(conn)
            const cleanPacket = packet && cleanRecord(packet)
            if (cleanPacket) {
                connPackets[mapName] = cleanPacket
            }
        }

        const data = getRemoteServerUpdatePacket(connPackets, conn)
        const toSend = multi.server.settings.netInfo!.details.forceJsonCommunication
            ? data
            : PhysicsUpdatePacketEncoderDecoder.encode(data)
        conn.send('update', toSend)
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

type PlayerMapChangeRecord = Record<MapName, { username: Username; marker: MapTpInfo['marker'] }[]>
export interface PhysicsServerUpdatePacket {
    /* sentAt has to be first! my custom socket-io-parser extracts this timestamp from the binary data */
    sendAt: f64
    // tick: f64
    mapPackets?: Record<MapName, StateUpdatePacket>
    playerMaps?: PlayerMapChangeRecord
}
export type GenerateType = PhysicsServerUpdatePacket

function getRemoteServerUpdatePacket(
    mapPackets: Record<MapName, StateUpdatePacket>,
    conn: NetConnection
): PhysicsServerUpdatePacket {
    const maps = conn.clients.reduce((acc, client) => {
        if (client.justTeleported) {
            client.justTeleported = false
            const { map, marker } = client.nextTpInfo
            ;(acc[map] ??= []).push({ username: client.username, marker })
        }
        return acc
    }, {} as PlayerMapChangeRecord)

    const data: PhysicsServerUpdatePacket = {
        mapPackets: Object.keys(mapPackets).length > 0 ? mapPackets : undefined,
        // tick: ig.system.tick,
        sendAt: Date.now(),
        playerMaps: cleanRecord(maps),
    }
    return data
}
