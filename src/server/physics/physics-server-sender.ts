import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import {
    clearCollectedState,
    getGlobalStateUpdatePacket,
    getStateUpdatePacket,
    type StateKey,
} from '../../state/states'
import type { CCMap } from '../ccmap/ccmap'
import type { NetConnection } from '../../net/connection'
import { cleanRecord } from '../../state/state-util'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'
import type { f64 } from 'ts-binarifier/src/type-aliases'
import type { MapName } from '../../net/binary/binary-types'
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

    const globalPackets: Map<NetConnection, GlobalStateUpdatePacket> = new Map()
    let globalCachePacket: GlobalStateUpdatePacket | undefined

    const packets: Record<MapName, Map<NetConnection, StateUpdatePacket>> = {}
    for (const conn of connections) {
        const globalPacket1: GlobalStateUpdatePacket = {}
        globalPackets.set(conn, getGlobalStateUpdatePacket(globalPacket1, conn, globalCachePacket))
        const globalPacket = cleanRecord(globalPacket1)

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

        const data = getRemoteServerUpdatePacket(globalPacket, connPackets)
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

export interface PhysicsServerUpdatePacket {
    /* sentAt has to be first! my custom socket-io-parser extracts this timestamp from the binary data */
    sendAt: f64
    global?: GlobalStateUpdatePacket
    mapPackets?: Record<MapName, StateUpdatePacket>
}
export type GenerateType = PhysicsServerUpdatePacket

function getRemoteServerUpdatePacket(
    global: GlobalStateUpdatePacket | undefined,
    mapPackets: Record<MapName, StateUpdatePacket>
): PhysicsServerUpdatePacket {
    const data: PhysicsServerUpdatePacket = {
        global,
        mapPackets: Object.keys(mapPackets).length > 0 ? mapPackets : undefined,
        sendAt: Date.now(),
    }
    return data
}
