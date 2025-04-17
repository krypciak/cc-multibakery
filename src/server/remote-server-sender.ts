import { Client } from '../client/client'
import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { EntityStateUpdatePacketRecord, getFullEntityState } from '../state/states'
import { CCMap } from './ccmap'
import { RemoteServer } from './remote-server'

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof RemoteServer && instanceinator.id == multi.server.serverInst.id) {
                send()
            }
        },
    })
})

function send() {
    // const mapPackets: Record<string, RemoteServerInputPacket> = {}
    //
    // for (const mapName in multi.server.maps) {
    //     const map = multi.server.maps[mapName]
    //     if (!map.inst) continue
    //     mapPackets[mapName] = getMapUpdatePacket(map)
    // }
    //
    // for (const username in multi.server.clients) {
    //     const client = multi.server.clients[username]
    //     const conn = client.inst.ig.netConnection
    //     if (!conn) continue
    //     const data = getRemoteServerInputPacket(client, mapPackets[client.player.mapName])
    //     conn.sendUpdate(data)
    // }
}

export interface CCMapInputPacket {}

export interface RemoteServerInputPacket {}

function getRemoteServerInputPacket(_client: Client): RemoteServerInputPacket {
    const data: RemoteServerInputPacket = {}
    return data
}
