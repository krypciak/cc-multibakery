import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { clearCollectedState, getStateUpdatePacket, StateKey } from '../../state/states'
import { CCMap } from '../ccmap/ccmap'
import { PhysicsServer } from './physics-server'
import { NetConnection } from '../../net/connection'
import { cleanRecord } from '../../state/state-util'

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

    const connections = multi.server.netManager.connections

    const packets: Record</* mapName */ string, Map<NetConnection, StateUpdatePacket>> = {}
    for (const conn of connections) {
        const readyMaps = multi.server.connectionReadyMaps.get(conn)

        for (const client of conn.clients) {
            const mapName = client.mapName
            const map = multi.server.maps[mapName]
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

        const data = getRemoteServerUpdatePacket(connPackets)
        conn.send('update', data)
    }

    runTasks(
        Object.values(multi.server.maps).map(map => map.inst),
        () => {
            clearCollectedState()
        }
    )
}

function getMapUpdatePacket(map: CCMap, dest?: StateUpdatePacket, key?: StateKey, cache?: StateUpdatePacket) {
    runTask(map.inst, () => getStateUpdatePacket(dest, key, cache))
}

export interface PhysicsServerUpdatePacket {
    mapPackets?: Record</* mapName */ string, StateUpdatePacket>
    tick: number
    sendAt: number
}
function getRemoteServerUpdatePacket(mapPackets: Record<string, StateUpdatePacket>): PhysicsServerUpdatePacket {
    const data: PhysicsServerUpdatePacket = {
        mapPackets: Object.keys(mapPackets).length > 0 ? mapPackets : undefined,
        tick: ig.system.tick,
        sendAt: Date.now(),
    }
    return data
}
