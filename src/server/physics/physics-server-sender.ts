import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { clearCollectedMapState, getMapStateUpdatePacket } from '../../state/map-state-handlers'
import { clearCollectedGlobalState, getGlobalStateUpdatePacket } from '../../state/global-state-handlers'
import type { StateKey } from '../../state/map-state-handlers'
import type { CCMap } from '../ccmap/ccmap'
import type { NetConnection } from '../../net/net-connection'
import { cleanRecord } from '../../state/state-util'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'
import type { f64 } from 'ts-binarifier/src/type-aliases'
import type { MapName } from '../../net/binary/binary-types'
import { assertPhysics } from './physics-server-types'
import { assert } from '../../misc/assert'
import { packetDeepEqual } from '../../net/packet-deep-equal'
import { profile } from '../../misc/performance-profiling'

declare global {
    interface StateUpdatePacket {
        kicks?: Record<
            string,
            {
                reason: string
            }
        >
        crash?: {
            tryReconnect: boolean
            reason?: string
        }
    }
}

export interface PhysicsServerUpdatePacket {
    /* sentAt has to be first! my custom socket-io-parser extracts this timestamp from the binary data */
    sendAt: f64
    global?: GlobalStateUpdatePacket
    mapPackets?: Record<MapName, StateUpdatePacket>
}
export type GenerateType = PhysicsServerUpdatePacket

export class PhysicsSender {
    // only for profiling metadata
    private static currentConn?: NetConnection

    @profile(undefined, 'physics sender', true)
    static collectAndSend() {
        assert(PHYSICSNET)
        if (!PHYSICSNET) return
        assertPhysics(multi.server)
        assert(multi.server.netManager)
        const connections = multi.server.netManager.connections

        const globalPackets: Map<NetConnection, GlobalStateUpdatePacket> = new Map()
        let globalCachePacket: GlobalStateUpdatePacket | undefined

        const packets: Record<MapName, Map<NetConnection, StateUpdatePacket>> = {}
        for (const conn of connections) {
            if (!conn.readyForSendingUpdate) continue
            this.currentConn = conn

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

                if (client.destroyed) {
                    if (!map) {
                        dest.crash = { tryReconnect: true }
                    } else {
                        dest.kicks ??= {}
                        dest.kicks[client.username] = { reason: client.kickReason ?? '' }
                        conn.leave(client)
                    }
                    continue
                }

                if (!map?.inst || !readyMaps || !readyMaps.has(mapName)) continue
                this.getMapUpdatePacket(map, dest, client.dummy, cachePacket)
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

            const data = this.getRemoteServerUpdatePacket(globalPacket, connPackets)
            const toSend = this.encodePacket(data)
            this.verifyPacketEncoding(toSend, data)

            conn.middleware.send('update', toSend)
        }

        this.clearCollectedState()
        this.currentConn = undefined
    }

    @profile((_self, map) => `${map.name}`, 'physics sender', true)
    private static getMapUpdatePacket(map: CCMap, dest?: StateUpdatePacket, key?: StateKey, cache?: StateUpdatePacket) {
        runTask(map.inst, () => getMapStateUpdatePacket(dest, key, cache))
    }

    @profile((self, _) => `${self.currentConn?.transport.getConnectionInfo()}`, 'physics sender', true)
    private static encodePacket(data: PhysicsServerUpdatePacket) {
        assertPhysics(multi.server)
        const forceJson = multi.server.settings.netInfo!.details.forceJsonCommunication
        return forceJson ? data : PhysicsUpdatePacketEncoderDecoder.encode(data)
    }

    private static verifyPacketEncoding(packet: unknown, originalPacket: PhysicsServerUpdatePacket) {
        if (DEV && packet instanceof Uint8Array) {
            const decoded = PhysicsUpdatePacketEncoderDecoder.decode(packet)
            assert(packetDeepEqual(originalPacket, decoded), 'physics packet decoding mismatch!')
        }
    }

    private static getRemoteServerUpdatePacket(
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

    private static clearCollectedState() {
        clearCollectedGlobalState()
        runTasks(
            [...multi.server.maps.values()].filter(map => map.ready).map(map => map.inst),
            () => clearCollectedMapState()
        )
    }
}
