import { Client } from '../client/client'
import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { EntityStateUpdatePacketRecord, getFullEntityState } from '../state/states'
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
    const mapPackets: Record<string, CCMapUpdatePacket> = {}

    for (const mapName in multi.server.maps) {
        const map = multi.server.maps[mapName]
        if (!map.inst) continue
        mapPackets[mapName] = getMapUpdatePacket(map)
    }

    for (const username in multi.server.clients) {
        const client = multi.server.clients[username]
        const conn = client.inst.ig.netConnection
        if (!conn) continue
        const data = getRemoteServerUpdatePacket(client, mapPackets[client.player.mapName])
        conn.sendUpdate(data)
    }
}

export interface CCMapUpdatePacket {
    entities: EntityStateUpdatePacketRecord
}
function getMapUpdatePacket(map: CCMap): CCMapUpdatePacket {
    const data: CCMapUpdatePacket = {
        entities: getFullEntityState(map.inst.ig.game.entities),
    }
    return data
}

export interface RemoteServerUpdatePacket {
    mapPacket: CCMapUpdatePacket
}
function getRemoteServerUpdatePacket(_client: Client, mapPacket: CCMapUpdatePacket): RemoteServerUpdatePacket {
    assert(mapPacket)
    const data: RemoteServerUpdatePacket = {
        mapPacket,
    }
    return data
}
