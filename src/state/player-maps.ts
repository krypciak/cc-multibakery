import { prestart } from '../loading-stages'
import { addGlobalStateHandler } from './states'
import type { MapName, Username } from '../net/binary/binary-types'
import type { MapTpInfo } from '../server/server'
import { cleanRecord } from './state-util'

type PlayerMapChangeRecord = Record<MapName, { username: Username; marker: MapTpInfo['marker'] }[]>

declare global {
    interface GlobalStateUpdatePacket {
        playerMaps?: PlayerMapChangeRecord
    }
}

prestart(() => {
    addGlobalStateHandler({
        get(packet, conn) {
            const maps = conn.clients.reduce((acc, client) => {
                if (client.justTeleported) {
                    client.justTeleported = false
                    const { map, marker } = client.nextTpInfo
                    ;(acc[map] ??= []).push({ username: client.username, marker })
                }
                return acc
            }, {} as PlayerMapChangeRecord)

            packet.playerMaps = cleanRecord(maps)
        },
        set(packet) {
            if (!packet.playerMaps) return

            // console.log(JSON.stringify(data.playerMaps, null, 4))
            for (const mapName in packet.playerMaps) {
                const mapRecord = packet.playerMaps[mapName]
                for (const { username, marker } of mapRecord) {
                    const client = multi.server.clients.get(username)
                    if (!client?.ready) continue

                    client.teleport({ map: mapName, marker })
                }
            }
        },
    })
})
