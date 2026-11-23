import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { isRemote } from '../remote/remote-server-types'
import { getPreTeleportInfoForArMsg, showTeleportArMsg } from '../../client/teleport-arbox'
import type { MapTpInfo } from '../server-types'

export type MarkerLike = ig.Entity & { name: string; applyMarkerPosition(entity: ig.Entity): void }

export function normalizeMapName(mapName: string): string {
    return mapName.replace(/\./g, '/')
}

export function getMarkerLikeEntities(game: ig.Game): MarkerLike[] {
    return game.shownEntities.filter(e => e && 'applyMarkerPosition' in e) as MarkerLike[]
}

export function getTeleportDestinationMarkerAndEntity(inputMarker: Nullable<string> | undefined): {
    marker: Nullable<string> | undefined
    markerLike?: MarkerLike
} {
    let marker: string | undefined

    const markerLikes = getMarkerLikeEntities(ig.game)

    let found: MarkerLike | undefined = markerLikes.find(e => e.name == inputMarker)
    if (!found) found = markerLikes[0]

    if (found) {
        return { marker: found.name, markerLike: found }
    }
    return { marker }
}

export function teleportPlayerToProperMarker(
    player: ig.ENTITY.Player | undefined,
    inputMarker: Nullable<string> | undefined
) {
    const { markerLike } = getTeleportDestinationMarkerAndEntity(inputMarker)
    if (markerLike && player) {
        markerLike.applyMarkerPosition(player)
    }
}

prestart(() => {
    function runTeleport(player: dummy.DummyPlayer, tpInfo: MapTpInfo, eventCall?: ig.EventCall) {
        const client = player.getClient()

        tpInfo.map = normalizeMapName(tpInfo.map)

        const preTeleportInfo = getPreTeleportInfoForArMsg(client)

        runTask(multi.server.inst, () => client.teleport(tpInfo))

        showTeleportArMsg(client, tpInfo.map, eventCall, preTeleportInfo)
    }

    ig.Game.inject({
        isPlayerTouch(entity, player, dir) {
            if (!multi.server || ig.client) return this.parent(entity, player, dir)

            if (player instanceof dummy.DummyPlayer) {
                const client = player.getClient(true)
                if (client) return runTask(client.inst, () => ig.game.isPlayerTouch(entity, player, dir))
            }
            /* only thing changed is
             * player != this.playerEntity
             * replaced with
             * !player.isPlayer */
            if (!player.isPlayer || this.events.getBlockingEventCall() || !dir) return false
            const coll = player.coll
            return Math.abs(dir.x) > Math.abs(dir.y)
                ? (dir.x > 0 && coll.accelDir.x > 0) || (dir.x < 0 && coll.accelDir.x < 0)
                : (dir.y > 0 && coll.accelDir.y > 0) || (dir.y < 0 && coll.accelDir.y < 0)
        },
        teleport(mapName, marker, hint, clearCache, reloadCache) {
            if (!multi.server) return this.parent(mapName, marker, hint, clearCache, reloadCache)

            assert(ig.client, 'ig.Game#teleport called on map instance')
            const tpInfo: MapTpInfo = { map: mapName, marker: typeof marker == 'string' ? marker : marker?.marker }
            if (marker && typeof marker === 'object') {
                if (marker.face) ig.client.teleportOverrides.face = marker.face
                if (marker.pos) ig.client.teleportOverrides.pos = () => marker.pos as Vec2
            }
            runTeleport(ig.client.dummy, tpInfo)
        },
    })

    ig.EVENT_STEP.TELEPORT.inject({
        start(data, eventCall) {
            if (!multi.server) return this.parent(data, eventCall)
            if (isRemote(multi.server)) return

            const player = ig.client?.dummy ?? eventCall?.stack[0]?.stepData?._actionEntity
            assert(player, 'nuh uh ig.EVENT_STEP.TELEPORT player not sniffed :((')
            assert(player instanceof dummy.DummyPlayer)

            runTeleport(player, { map: this.map, marker: this.marker }, eventCall)
        },
    })

    function fixCollideWith<T extends ig.Entity>(this: T & { parent: T['collideWith'] }, entity: ig.Entity, dir: Vec2) {
        if (!(entity instanceof dummy.DummyPlayer)) return this.parent(entity, dir)

        const client = entity.getClient(true)
        if (client) {
            runTask(client.inst, () => this.parent(entity, dir))
        } else {
            this.parent(entity, dir)
        }
        this.coll.ignoreCollision = false
    }

    ig.ENTITY.TeleportGround.inject({ collideWith: fixCollideWith })
    ig.ENTITY.Door.inject({ collideWith: fixCollideWith })
    ig.ENTITY.TeleportStairs.inject({ collideWith: fixCollideWith })
})
