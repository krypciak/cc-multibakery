import { type MapName, type Username } from '../net/binary/binary-types'

export type PlayerLocation = {
    pos: Vec2 | undefined
}

export type PlayerLocationRecord = Record<MapName, Record<Username, PlayerLocation>>

let locations: PlayerLocationRecord = {}

export function getPlayerLocations(): PlayerLocationRecord {
    return { ...locations }
}

export function updatePlayerLocations() {
    for (const map of multi.server.getActiveAndReadyMaps()) {
        const mapRecord = (locations[map.name] ??= {})

        for (const entity of map.inst.ig.game.entities) {
            if (!(entity instanceof dummy.DummyPlayer)) continue

            const mapSize: Vec2 = map.inst.ig.game.size

            mapRecord[entity.data.username] = {
                pos: {
                    x: entity.coll.pos.x / mapSize.x,
                    y: (entity.coll.pos.y - entity.coll.pos.z) / mapSize.y,
                },
            }
        }
    }
}
export function invalidateOldPlayerLocations() {
    for (const mapName in locations) {
        const map = multi.server.maps.get(mapName)
        if (!map) {
            delete locations[mapName]
            continue
        }

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
                mapRecord[username] = { pos: undefined }
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
