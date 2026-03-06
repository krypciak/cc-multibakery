import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { isRemote } from '../remote/is-remote-server'

export type MarkerLike = ig.Entity & { name: string; applyMarkerPosition(entity: ig.Entity): void }

export function teleportPlayerToProperMarker(
    player: ig.ENTITY.Player | undefined,
    inputMarker: Nullable<string> | undefined,
    tpPos: ig.TeleportPosition | undefined,
    whateverMarkerYouFind: boolean = false
): string | undefined {
    let marker: string | undefined
    if (!player) return marker

    if (!tpPos || tpPos.marker) {
        const markerLikes: MarkerLike[] = ig.game.shownEntities.filter(
            e => e && 'applyMarkerPosition' in e
        ) as MarkerLike[]

        let found: MarkerLike | undefined = markerLikes.find(e => e.name == inputMarker)
        if (!found && whateverMarkerYouFind) found = markerLikes[0]

        if (found && player) {
            marker = found.name
            found.applyMarkerPosition(player)
        }
    } else {
        if (!tpPos) throw new Error('advancedTeleportMarkerBs what')
        marker = undefined
        player.coll.level = tpPos.level.toString()
        player.coll.baseZPos = tpPos.baseZPos
        player.coll.pos.z = tpPos.pos!.z
        player.face.x = tpPos.face!.x
        player.face.y = tpPos.face!.y
        player.setPos(
            tpPos.pos!.x + tpPos.size!.x / 2 - player.coll.size.x / 2,
            tpPos.pos!.y + tpPos.size!.y / 2 - player.coll.size.y / 2
        )
    }
    return marker
}

prestart(() => {
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

            assert(false)
        },
    })

    ig.EVENT_STEP.TELEPORT.inject({
        start(data, eventCall) {
            if (!multi.server) return this.parent(data, eventCall)
            if (isRemote(multi.server)) return

            const player: ig.ENTITY.Player | undefined =
                ig.client?.dummy ?? eventCall?.stack[0]?.stepData?._actionEntity
            assert(player, 'nuh uh ig.EVENT_STEP.TELEPORT player not sniffed :((')
            assert(player.isPlayer, 'that is just ridiculous ig.EVENT_STEP.TELEPORT')
            assert(player instanceof dummy.DummyPlayer)

            const client = player.getClient()

            const destMapName = this.map.replace(/\./g, '/')

            runTask(multi.server.inst, async () => {
                await client.teleport({ map: destMapName, marker: this.marker })
            })
        },
    })

    /* fix the goddamn door not being openable after one player passes through it */
    ig.ENTITY.Door.inject({
        close() {
            this.parent()
            this.coll.ignoreCollision = false
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
