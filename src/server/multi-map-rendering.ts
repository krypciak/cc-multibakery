import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import type { MapTpInfo } from './server-types'
import { getTeleportDestinationMarkerAndEntity, normalizeMapNameFromMarkerLike } from './ccmap/teleport-fix'
import { assert } from '../misc/assert'
import { Opts } from '../options'
import type { CCMap } from './ccmap/ccmap'

interface MultiMapRenderingMapInfoEntry {
    tpInfo: MapTpInfo
    fromMarkerLike: ig.ENTITY.TeleportGround
    map?: CCMap
    toMarkerLike?: ig.ENTITY.TeleportGround
}

declare global {
    namespace ig {
        interface MapSharedVars {
            multiMapRenderingMaps: MultiMapRenderingMapInfoEntry[]
        }
        var guiDrawOffset: Vec2 | undefined
        var renderer2dNoClear: boolean | undefined
    }
}

export function findNeighbouringMapsForMultiMapRendering() {
    assert(ig.ccmap)
    if (!Opts.multiMapRendering) return

    const teleportGrounds = ig.game.entities.filter(
        e => e instanceof ig.ENTITY.TeleportGround
    ) as ig.ENTITY.TeleportGround[]

    const entries: MultiMapRenderingMapInfoEntry[] = []
    for (const fromMarkerLike of teleportGrounds) {
        const mapName = normalizeMapNameFromMarkerLike(fromMarkerLike.map ?? '')
        if (!mapName) continue
        if (entries.find(e => e.tpInfo.map == mapName)) continue

        const tpInfo: MapTpInfo = { map: mapName, marker: fromMarkerLike.marker }

        entries.push({ tpInfo, fromMarkerLike })
    }
    ig.mapShared.multiMapRenderingMaps = entries
}

export async function loadNeighbouringMapsForMultiMapRendering() {
    const arr = ig.mapShared.multiMapRenderingMaps
    if (!Opts.multiMapRendering || !arr) return

    await Promise.all(
        arr.map(async entry => {
            const { tpInfo, fromMarkerLike } = entry
            const map = multi.server.getMap(tpInfo)
            await runTask(multi.server.inst, () => map.initIfNeeded())

            const { marker, markerLike: toMarkerLike } = runTask(map.inst, () =>
                getTeleportDestinationMarkerAndEntity(fromMarkerLike.marker)
            )
            if (!toMarkerLike || !(toMarkerLike instanceof ig.ENTITY.TeleportGround)) {
                arr.erase(entry)
                return
            }
            entry.map = map
            entry.tpInfo = { map: map.name, marker }
            entry.toMarkerLike = toMarkerLike
            fromMarkerLike.noDelayTeleport = true

            map.inst.initDrawBuffers()

            await map.loadResourcesIfNeeded()
        })
    )
    console.log(arr)
}

function drawMap({ map, fromMarkerLike, toMarkerLike }: MultiMapRenderingMapInfoEntry) {
    if (!map) return

    assert(toMarkerLike)
    const fromPos: Vec2 = {
        x: fromMarkerLike.coll.pos.x,
        y: fromMarkerLike.coll.pos.y - fromMarkerLike.coll.pos.z,
    }
    const toPos: Vec2 = {
        x: toMarkerLike.coll.pos.x,
        y: toMarkerLike.coll.pos.y - toMarkerLike.coll.pos.z,
    }
    const destPos = Vec2.sub(Vec2.create(fromPos), toPos)
    const newScreenPos = Vec2.sub(Vec2.create(ig.game.screen), destPos)

    const backupContext = map.inst.ig.system.context
    const screenBackup = map.inst.ig.game.screen
    try {
        map.inst.ig.system.context = ig.system.context
        map.inst.ig.game.screen = newScreenPos
        map.inst.ig.guiDrawOffset = destPos
        runTask(map.inst, () => {
            for (const level of Object.values(ig.game.levels)) {
                for (const map of level.maps ?? []) {
                    map.setScreenPos(newScreenPos.x, newScreenPos.y)
                }
            }

            for (const addon of ig.game.addons.preDraw) addon.onPreDraw()
            ig.system.startZoomedDraw()
            ig.game.renderer.prepareDraw(ig.game.shownEntities)
            ig.game.renderer.drawLayers(undefined, true)
            // for (const addon of ig.game.addons.midDraw) addon.onMidDraw()
            ig.game.renderer.drawPostLayerSprites()
            ig.system.endZoomedDraw()
            for (const addon of ig.game.addons.postDraw) addon.onPostDraw()
        })
    } finally {
        if (map?.inst.ig) {
            map.inst.ig.system.context = backupContext
            map.inst.ig.game.screen = screenBackup
            map.inst.ig.guiDrawOffset = undefined
        }
    }
}

prestart(() => {
    ig.Renderer2d.inject({
        drawLayers(force, noClear) {
            return this.parent(force, noClear || ig.renderer2dNoClear)
        },
    })

    ig.Game.inject({
        draw() {
            if (!ig.client) return this.parent()
            if (!ig.mapShared?.multiMapRenderingMaps) return this.parent()

            ig.camera._cameraInBounds = false

            for (const entry of ig.mapShared.multiMapRenderingMaps) {
                drawMap(entry)
            }

            ig.renderer2dNoClear = true
            this.parent()
            ig.renderer2dNoClear = false
        },
    })

    ig.GuiDrawable.inject({
        draw(targetX, targetY, ...args) {
            const offset = ig.guiDrawOffset
            if (!offset) return this.parent(targetX, targetY, ...args)
            return this.parent(targetX + offset.x, targetY + offset.y, ...args)
        },
    })
})

declare global {
    namespace ig.ENTITY {
        interface TeleportGround {
            noDelayTeleport?: boolean
        }
    }
}
prestart(() => {
    ig.ENTITY.TeleportGround.inject({
        collideWith(entity, dir) {
            if (
                this.noDelayTeleport &&
                entity instanceof dummy.DummyPlayer &&
                this.map &&
                ig.game.isPlayerTouch(this, entity, dir) &&
                ig.game.isInterruptible() &&
                !sc.model.isMapLeaveBlocked() &&
                entity.coll.pos.z == this.coll.pos.z
            ) {
                const client = entity.getClient(true)
                if (client) client.noTeleportDelayOverride = true
            }
            return this.parent(entity, dir)
        },
    })
}, 0 /* before colideWith fix inject */)
