import { prestart } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'

export interface PlayerLocation {
    pos: Vec3
}

export type PlayerLocationRecord = Record<
    /* map name */ string,
    Record</* username */ string, Nullable<PlayerLocation>>
>

let locations: PlayerLocationRecord = {}

export function getPlayerLocations(): PlayerLocationRecord {
    return locations
}

function updatePlayerLocations() {
    for (const mapName in multi.server.maps) {
        const map = multi.server.maps[mapName]
        if (!map.ready) continue
        const mapRecord = (locations[mapName] ??= {})

        for (const player of map.players) {
            const dummy = player.dummy
            if (!dummy) continue

            mapRecord[player.username] = {
                pos: Vec3.create(dummy.coll.pos),
            }
        }
    }
}
function invalidateOldPlayerLocations() {
    for (const mapName in locations) {
        const mapRecord = locations[mapName]
        for (const username in mapRecord) {
            const client = multi.server.clients[username]
            if (!client || client.player.mapName != mapName) {
                mapRecord[username] = null
            }
        }
    }
}

export function mergePlayerLocations(newLocations: PlayerLocationRecord) {
    for (const mapName in newLocations) {
        const mapRecord = newLocations[mapName]
        if (!newLocations[mapName]) {
            locations[mapName] = mapRecord
        } else {
            const locationsMapRecord = locations[mapName]
            for (const username in mapRecord) {
                locationsMapRecord[username] = mapRecord[username]
            }
        }
    }
    for (const username in newLocations) {
        newLocations[username] = newLocations[username]
    }
}

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server && instanceinator.id == multi.server.serverInst.id) {
                updatePlayerLocations()
                if (multi.server instanceof PhysicsServer) {
                    invalidateOldPlayerLocations()
                }
            }
        },
    })
})
