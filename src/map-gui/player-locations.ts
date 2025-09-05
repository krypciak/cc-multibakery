import { prestart } from '../loading-stages'

export type PlayerLocation = Vec3

export type PlayerLocationRecord = Record<
    /* map name */ string,
    Record</* username */ string, Nullable<PlayerLocation>>
>

let locations: PlayerLocationRecord = {}

export function getPlayerLocations(): PlayerLocationRecord {
    return { ...locations }
}

function updatePlayerLocations() {
    for (const map of multi.server.getActiveAndReadyMaps()) {
        const mapRecord = (locations[map.name] ??= {})

        for (const entity of map.inst.ig.game.entities) {
            if (!(entity instanceof dummy.DummyPlayer)) continue

            mapRecord[entity.data.username] = Vec3.create(entity.coll.pos)
        }
    }
}
function invalidateOldPlayerLocations() {
    for (const mapName in locations) {
        const map = multi.server.maps[mapName]
        if (!map) continue

        const players = Object.fromEntries(
            (map.inst.ig.game.entities.filter(e => e instanceof dummy.DummyPlayer) as dummy.DummyPlayer[]).map(e => [
                e.data.username,
                e,
            ])
        )

        const mapRecord = locations[mapName]
        for (const username in mapRecord) {
            const player = players[username]
            if (!player) {
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
            const locationsMapRecord = (locations[mapName] ??= {})
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
                invalidateOldPlayerLocations()
            }
        },
    })
})
