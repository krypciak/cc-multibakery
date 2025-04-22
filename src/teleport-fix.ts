import { prestart } from './plugin'

export function teleportPlayerToProperMarker(
    player: ig.ENTITY.Player | undefined,
    inputMarker: Nullable<string> | undefined,
    tpPos: ig.TeleportPosition | undefined,
    whateverMarkerYouFind: boolean = false
): string | undefined {
    let marker: string | undefined
    if (!player) return marker

    if (!tpPos || tpPos.marker) {
        type MarkerLike = ig.Entity & { name: string; applyMarkerPosition(player: ig.ENTITY.Player): void }

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
    // ig.Game.inject({
    //     isPlayerTouch(_entity, player, dir) {
    //         if (!player.isPlayer || this.events.getBlockingEventCall() || !dir) return false
    //         const coll = player.coll
    //         return Math.abs(dir.x) > Math.abs(dir.y)
    //             ? (dir.x > 0 && coll.accelDir.x > 0) || (dir.x < 0 && coll.accelDir.x < 0)
    //             : (dir.y > 0 && coll.accelDir.y > 0) || (dir.y < 0 && coll.accelDir.y < 0)
    //     },
    //     teleport(mapName, marker, hint, clearCache, reloadCache) {
    //         ig.game.mapName = mapName
    //         ig.game.marker = marker?.marker
    //     },
    // })

    // ig.EVENT_STEP.TELEPORT.inject({
    //     start(_data, eventCall) {
    //         const player: ig.ENTITY.Player | undefined = eventCall?.stack[0]?.stepData?._actionEntity
    //         if (!player) {
    //             console.error('nuh uh ig.EVENT_STEP.TELEPORT player not sniffed :((')
    //             return
    //         }
    //         if (!player.isPlayer) throw new Error('that is just ridiculous ig.EVENT_STEP.TELEPORT')
    //         const tpPos = this.marker ? new ig.TeleportPosition(this.marker) : undefined
    //         if (player instanceof dummy.DummyPlayer) {
    //             const playerClass = multi.server.getPlayerByEntity(player)
    //             playerClass.isTeleporting = true
    //             /* this is hacky but works */
    //             /* ignore the above comment, this blocks client-side player movement for a brief moment after teleporting */
    //             setTimeout(() => {
    //                 playerClass.getMap().then(map => {
    //                     map.scheduledFunctionsForUpdate.push(() => {
    //                         playerClass.teleport(this.map, tpPos?.marker)
    //                     })
    //                 })
    //             }, 500)
    //         } else {
    //             ig.game.marker = tpPos?.marker
    //             multi.server.prepareNewLevelView(this.map, tpPos)
    //         }
    //     },
    // })

    /* fix the goddamn door not being openable after one player passes through it */
    ig.ENTITY.Door.inject({
        close() {
            this.parent()
            this.coll.ignoreCollision = false
        },
    })
})
