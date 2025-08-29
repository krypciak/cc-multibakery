import { prestart } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'

export interface PlayerLocation {
    mapName: string
    pos: Vec3
}

export type PlayerLocationRecord = Record<string, Nullable<PlayerLocation>>

let locations: PlayerLocationRecord = {}

export function getPlayerLocations(): PlayerLocationRecord {
    return locations
}

function updatePlayerLocations() {
    const oldKeys = new Set(Object.keys(locations))
    for (const username in multi.server.clients) {
        const client = multi.server.clients[username]
        const dummy = client.player.dummy
        if (!dummy) continue

        locations[username] = {
            mapName: client.player.mapName,
            pos: Vec3.create(dummy.coll.pos),
        }
        oldKeys.delete(username)
    }

    for (const username of oldKeys) {
        locations[username] = null
    }
}
export function mergePlayerLocations(record: PlayerLocationRecord) {
    for (const username in record) {
        locations[username] = record[username]
    }
}

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server && instanceinator.id == multi.server.serverInst.id) {
                if (multi.server instanceof PhysicsServer) {
                    updatePlayerLocations()
                }
            }
        },
    })
})
