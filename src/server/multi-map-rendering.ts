import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import type { MapTpInfo } from './server-types'
import { getTeleportDestinationMarkerAndEntity, normalizeMapName } from './ccmap/teleport-fix'
import { assert } from '../misc/assert'
import { Opts } from '../options'
import { CCMap } from './ccmap/ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

export interface Rect extends Vec2 {
    width: number
    height: number
}

function getOverlapingEntries<T extends { rect: Rect }>(mainRect: Rect, entries: T[], border: number): T[] {
    const { x, y, width, height } = mainRect
    return entries.filter(({ rect }) => {
        const expandedRect = {
            x: rect.x - border,
            y: rect.y - border,
            width: rect.width + border * 2,
            height: rect.height + border * 2,
        }

        return (
            x < expandedRect.x + expandedRect.width &&
            x + width > expandedRect.x &&
            y < expandedRect.y + expandedRect.height &&
            y + height > expandedRect.y
        )
    })
}

function getCenterOfSide({ x, y, width, height }: Rect, dir: keyof typeof ig.ActorEntity.FACE4): Vec2 {
    if (dir == 'NORTH') {
        return { x: x + width / 2, y }
    } else if (dir == 'SOUTH') {
        return { x: x + width / 2, y: y + height }
    } else if (dir == 'WEST') {
        return { x, y: y + height / 2 }
    } else {
        return { x: x + width, y: y + height / 2 }
    }
}

function getCenterOfSideFromTeleportGround(tpg: ig.ENTITY.TeleportGround): Vec2 {
    const vec = getCenterOfSide(
        {
            x: tpg.coll.pos.x,
            y: tpg.coll.pos.y,
            width: tpg.coll.size.x,
            height: tpg.coll.size.y,
        },
        tpg.dir
    )
    vec.y -= tpg.coll.pos.z
    return vec
}

function getPosOffset(fromMarkerLike: ig.ENTITY.TeleportGround, toMarkerLike: ig.ENTITY.TeleportGround) {
    const fromPos = getCenterOfSideFromTeleportGround(fromMarkerLike)
    const toPos = getCenterOfSideFromTeleportGround(toMarkerLike)

    const posOffset = Vec2.sub(Vec2.create(fromPos), toPos)
    return posOffset
}

interface OverrideEntry {
    disable?: boolean
    drawCondition?: () => boolean
    offset?: Vec2
    tpOffset?: Vec2
    delay?: number
}
const overrides: Record<string, Record<string, OverrideEntry>> = {
    'autumn/path6': { 'evo-village/entrance': { drawCondition: () => ig.vars.get('map.showPath') } },

    'bergen-trail/path-1-entrance': { 'bergen-trail/path-2': { offset: { x: 8, y: 0 } } },
    'bergen-trail/path-2': { 'bergen-trail/path-1-entrance': { offset: { x: -8, y: 0 } } },

    'jungle/grove/lost-shrine-01': { 'jungle/grove/grove-path-02': { disable: true } },
    'jungle/grove/grove-path-02': { 'jungle/grove/lost-shrine-01': { disable: true } },

    'final-dng/b4/stargate': { 'final-dng/b4/corridor': { disable: true } },
    'final-dng/b4/corridor': { 'final-dng/b4/stargate': { disable: true } },
}

interface MultiMapRenderingMapInfoEntry {
    tpInfo: MapTpInfo
    fromMarkerLike: ig.ENTITY.TeleportGround
    duplicate: boolean
    map?: CCMap
    toMarkerLike?: ig.ENTITY.TeleportGround

    posOffset?: Vec2
    tpPosOffset?: Vec3
    delay?: number
    zDiff?: number
    drawCondition?: () => boolean
}

function getOverrideEntry(fromMapName: string, toMapName: string) {
    return overrides[fromMapName]?.[toMapName] as OverrideEntry | undefined
}

type Clamp = Record<keyof typeof ig.ActorEntity.FACE4, { value: number; func?: () => number }>

declare global {
    namespace ig {
        interface MapSharedVars {
            multiMapRenderingMaps?: {
                entries: MultiMapRenderingMapInfoEntry[]
                clamp: Clamp
            }
        }
    }
}

export function findNeighbouringMapsForMultiMapRendering() {
    assert(ig.ccmap)
    if (!Opts.multiMapRendering || ig.mapShared.multiMapRenderingMaps) return

    const entries: MultiMapRenderingMapInfoEntry[] = []

    const clamp: Clamp = { NORTH: { value: 0 }, SOUTH: { value: 0 }, EAST: { value: 0 }, WEST: { value: 0 } }

    if (isOutside(ig.ccmap.levelData!)) {
        const teleportGrounds = ig.game.entities.filter(
            e => e instanceof ig.ENTITY.TeleportGround
        ) as ig.ENTITY.TeleportGround[]

        for (const fromMarkerLike of teleportGrounds) {
            const mapName = normalizeMapName(fromMarkerLike.map ?? '')
            if (!mapName || mapName == ig.game.mapName) continue
            const duplicate = !!entries.find(e => e.tpInfo.map == mapName)

            const tpInfo: MapTpInfo = { map: mapName, marker: fromMarkerLike.marker }

            entries.push({ tpInfo, fromMarkerLike, duplicate })

            /* initial clamp calculation, more accurate one will be done in loadMap */
            clamp[fromMarkerLike.dir].value++
        }
    }
    ig.mapShared.multiMapRenderingMaps = {
        entries,
        clamp,
    }
}

function isOutside(data: sc.MapModel.Map): boolean {
    if (typeof data.attributes.weather == 'string' && data.attributes.weather?.startsWith('CAVE')) return false
    if (data.attributes.mapStyle == 'cave') return false
    if (data.attributes['map-sounds'].toLowerCase().includes('inner')) return false

    return true
}

async function loadMap(entry: MultiMapRenderingMapInfoEntry, clamp: Clamp): Promise<boolean> {
    const fromMapName = ig.game.mapName

    const { tpInfo, fromMarkerLike, duplicate } = entry
    const map = multi.server.getMap(tpInfo)

    const mapData = await map.readLevelData()

    if (!isOutside(mapData)) return false

    await runTask(multi.server.inst, () => map.initIfNeeded())

    const { marker, markerLike: toMarkerLike } = runTask(map.inst, () =>
        getTeleportDestinationMarkerAndEntity(fromMarkerLike.marker)
    )
    if (!toMarkerLike || !(toMarkerLike instanceof ig.ENTITY.TeleportGround)) return false

    entry.map = map
    entry.tpInfo = { map: map.name, marker }
    entry.toMarkerLike = toMarkerLike

    const overrideEntry = getOverrideEntry(fromMapName, map.name)
    if (overrideEntry?.disable) return false

    fromMarkerLike.multiMapRenderingEntry = entry

    const destOffset = getPosOffset(fromMarkerLike, toMarkerLike)
    if (overrideEntry?.offset) Vec2.add(destOffset, overrideEntry.offset)
    entry.posOffset = destOffset

    entry.tpPosOffset = { ...destOffset, z: 0 }
    if (overrideEntry?.tpOffset) Vec2.add(entry.tpPosOffset, overrideEntry.tpOffset)

    entry.delay = overrideEntry?.delay ?? 0.3

    entry.zDiff = entry.fromMarkerLike.coll.pos.z - entry.toMarkerLike!.coll.pos.z

    entry.drawCondition = overrideEntry?.drawCondition

    /* this asummes there can be only one drawCondition per side, whatever */
    if (entry.drawCondition) {
        clamp[fromMarkerLike.dir].func = () => (entry.drawCondition!() ? 1 : 0)
        clamp[fromMarkerLike.dir].value--
    }

    if (!duplicate) {
        map.inst.initDrawBuffers()

        await map.loadResourcesIfNeeded()
    }

    return true
}

export async function loadNeighbouringMapsForMultiMapRendering() {
    const obj = ig.mapShared.multiMapRenderingMaps
    if (!Opts.multiMapRendering || !obj) return
    const clamp = obj.clamp

    const includeArr = await Promise.all(
        obj.entries.map(async entry => {
            const include = await loadMap(entry, clamp)
            if (!include) clamp[entry.fromMarkerLike.dir].value--
            return include
        })
    )

    obj.entries = obj.entries.filter((_, i) => includeArr[i])
}

function wrapAndCopyDrawVars<T>(inst: InstanceinatorInstance, { screen }: { screen: Vec2 }, func: () => T) {
    const backupContext = inst.ig.system.context
    const screenBackup = inst.ig.game.screen
    const zoomBackup = inst.ig.system.zoom
    const zoomFocusBackup = inst.ig.system.zoomFocus
    const guiDrawBackup = inst.ig.perf.gui
    try {
        // const vec = Vec2.create()
        // runTask(inst, () => ig.system.getMapFromScreenPos(vec, vec.x, vec.y))

        inst.ig.system.context = ig.system.context
        inst.ig.game.screen = screen
        inst.ig.system.zoom = ig.system.zoom
        inst.ig.system.zoomFocus = ig.system.zoomFocus
        inst.ig.perf.gui = false

        // runTask(inst, () => ig.system.getScreenFromMapPos(vec, vec.x, vec.y))
        // inst.ig.guiDrawOffset = vec

        return runTask(inst, func)
    } finally {
        if (inst?.ig) {
            inst.ig.system.context = backupContext
            inst.ig.game.screen = screenBackup
            inst.ig.system.zoom = zoomBackup
            inst.ig.system.zoomFocus = zoomFocusBackup
            inst.ig.perf.gui = guiDrawBackup
        }
    }
}

interface LayerEntry {
    levelId: string
    level: ig.Game['levels'][string]
    config: MapDrawConfig
    adjustedLevelHeight: number
}

function getSortedLayers(array: LayerEntry[]): LayerEntry[] {
    const levelOrder: Record<string, number> = {
        first: -1,
        light: 100,
        postlight: 101,
        object1: 102,
        object2: 103,
        object3: 104,
    }

    function levelIdToRank(levelId: string) {
        if (levelId === 'first') return -1
        if (levelId === 'last') return Number.MAX_SAFE_INTEGER

        // Numeric levelIds: 0, 1, 2, 3, ...
        if (/^\d+$/.test(levelId)) {
            return Number(levelId)
        }

        return levelOrder[levelId] ?? Number.MAX_SAFE_INTEGER - 1
    }

    const sorted = array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const aIsNumber = /^\d+$/.test(a.item.levelId)
            const bIsNumber = /^\d+$/.test(b.item.levelId)

            if (aIsNumber && bIsNumber) {
                return a.item.adjustedLevelHeight - b.item.adjustedLevelHeight || a.index - b.index
            }

            const rankA = levelIdToRank(a.item.levelId)
            const rankB = levelIdToRank(b.item.levelId)

            if (rankA !== rankB) {
                return rankA - rankB
            }

            // Stable
            return a.index - b.index
        })
        .map(({ item }) => item)

    return sorted
}

type MapDrawConfig = { screen: Vec2; entry?: MultiMapRenderingMapInfoEntry; rect: Rect }

function runForMap<T>(config: MapDrawConfig, func: (config: MapDrawConfig) => T): T {
    if (config.entry) {
        return wrapAndCopyDrawVars(config.entry.map!.inst, { screen: config.screen! }, () => func(config))
    } else {
        return func(config)
    }
}

function getFilteredMapDrawConfigs(entries: MultiMapRenderingMapInfoEntry[]): MapDrawConfig[] {
    let mapDrawConfigs: MapDrawConfig[] = [
        ...entries
            .filter(entry => entry.map && !entry.duplicate && entry.posOffset)
            .map(entry => ({
                entry,
                screen: Vec2.sub(Vec2.create(ig.game.screen), entry.posOffset!),
                rect: {
                    ...entry.posOffset!,
                    width: entry.map!.inst.ig.game.size.x,
                    height: entry.map!.inst.ig.game.size.y,
                },
            })),
        { screen: Vec2.create(ig.game.screen), rect: { x: 0, y: 0, width: ig.game.size.x, height: ig.game.size.y } },
    ]

    const screenRect = { ...ig.game.screen, width: ig.system.width, height: ig.system.height }

    mapDrawConfigs = getOverlapingEntries(screenRect, mapDrawConfigs, 16 * 4.5)
    mapDrawConfigs = mapDrawConfigs.filter(({ entry }) => (entry?.drawCondition ? entry.drawCondition() : true))

    return mapDrawConfigs
}

function drawMaps(entries: MultiMapRenderingMapInfoEntry[], gameWithParent: ig.Game & { parent(): void }) {
    const mapDrawConfigs = getFilteredMapDrawConfigs(entries)

    function runForMaps<T>(func: (config: MapDrawConfig) => T): T[] {
        return mapDrawConfigs.map(config => runForMap(config, func))
    }

    runForMaps(({ screen }) => {
        for (const level of Object.values(ig.game.levels)) {
            for (const map of level.maps ?? []) {
                map.setScreenPos(screen.x, screen.y)
            }
        }
    })

    const lightContext = ig.light.lightContext
    lightContext.globalAlpha = 1
    lightContext.globalCompositeOperation = 'source-over'
    lightContext.clearRect(0, 0, ig.system.realWidth, ig.system.realHeight)

    function wrapLightContext(func: () => void) {
        const lightContextBackup = ig.light.lightContext
        const lightMapDarknessBackup = ig.light.lightMapDarkness
        const clearColorbackup = ig.game.clearColor
        const shadowProvidersBackup = ig.light.shadowProviders
        try {
            ig.light.lightContext = new Proxy(lightContext, {
                get(target, p, _receiver) {
                    if (p == 'clearRect' || p == 'fillRect') return () => {}
                    const value = Reflect.get(target, p, target)
                    if (typeof value === 'function') return value.bind(target)
                    return value
                },
                set(target, p, value) {
                    return Reflect.set(target, p, value, target)
                },
            })
            ig.light.lightMapDarkness = 0
            ig.game.clearColor = '#00000000'

            func()
        } finally {
            ig.light.lightContext = lightContextBackup
            ig.light.lightMapDarkness = lightMapDarknessBackup
            ig.game.clearColor = clearColorbackup
            ig.light.shadowProviders = shadowProvidersBackup
        }
    }

    wrapLightContext(() => {
        for (const addon of ig.game.addons.preDraw) addon.onPreDraw()
    })

    runForMaps(({ entry }) => {
        if (!entry) return
        wrapLightContext(() => {
            if (entry) {
                ig.light.shadowProviders = ig.light.shadowProviders.filter(
                    e => !(e instanceof ig.Fog) && !(e instanceof ig.Clouds)
                )
            }
            for (const addon of ig.game.addons.preDraw) addon.onPreDraw()
        })
    })

    for (const { entry } of mapDrawConfigs) {
        entry?.map!.setForceUpdateForFrames(multi.server.settings.gameTps)
    }

    ig.system.startZoomedDraw()

    runForMaps(() => {
        ig.game.renderer.prepareDraw(ig.game.shownEntities)
    })

    ig.system.context!.fillStyle = 'black'
    ig.game.clearColor && ig.system.clear(ig.game.clearColor)

    function getLayers(): LayerEntry[] {
        let allLayers: LayerEntry[] = runForMaps(config => {
            let entries = Object.entries(ig.game.levels).map(([levelId, level]) => ({
                levelId,
                level,
                config,
                adjustedLevelHeight: (level.height ?? 0) + (config.entry?.zDiff ?? 0),
            }))
            return entries
        }).flat()

        for (const layer of allLayers) {
            const hasParallax = (layer.level.maps ?? []).some(m => m.isParallax)
            if (hasParallax) layer.adjustedLevelHeight -= 1024
        }

        allLayers = getSortedLayers(allLayers)
        return allLayers
    }

    const allLayers = getLayers()

    function drawMaps(level: ig.Game['levels'][string]) {
        for (const map of level.maps!) {
            if (!map.enabled) continue
            map.drawAnimated?.()
            map.draw()
        }
    }

    for (const { levelId, level, config } of allLayers) {
        runForMap(config, () => {
            if (ig.game.mapRenderingBlocked || ig.loading || ig.game.maxLevel <= 0) return

            if (levelId == 'first' || levelId == 'last') {
                drawMaps(level)
            } else {
                const levelIdNum = Number(levelId)
                if (!Number.isNaN(levelIdNum)) {
                    if (levelIdNum >= 0) drawMaps(level)
                    ig.game.renderer.drawEntities(levelIdNum)
                }
            }
        })
    }

    for (const addon of ig.game.addons.midDraw) addon.onMidDraw()
    runForMaps(({ entry }) => {
        if (!entry) return
        // for (const addon of ig.game.addons.midDraw) addon.onMidDraw()

        ig.light.onMidDraw()
    })
    runForMaps(() => {
        ig.game.renderer.drawPostLayerSprites()
    })
    ig.system.endZoomedDraw()
    runForMaps(({ entry }) => {
        if (entry) return

        for (const addon of ig.game.addons.postDraw) addon.onPostDraw()
    })

    callNeutralizedIgGameDrawParent(gameWithParent)
}

prestart(() => {
    ig.Game.inject({
        draw() {
            if (!ig.client || !ig.mapShared) return this.parent()
            if (!Opts.multiMapRendering) return this.parent()

            if (!ig.mapShared?.multiMapRenderingMaps) {
                runTask(ig.mapShared.ccmap.inst, () => {
                    findNeighbouringMapsForMultiMapRendering()
                    loadNeighbouringMapsForMultiMapRendering()
                })
                return this.parent()
            } else {
                drawMaps(ig.mapShared.multiMapRenderingMaps.entries, this)
            }
        },
    })
})

let neutralize = false
function callNeutralizedIgGameDrawParent(gameWithParent: ig.Game & { parent(): void }) {
    neutralize = true
    const preDrawAddonsBackup = gameWithParent.addons.preDraw
    const midDrawAddonsBackup = gameWithParent.addons.midDraw
    const postDrawAddonsBackup = gameWithParent.addons.postDraw
    try {
        gameWithParent.addons.preDraw = []
        gameWithParent.addons.midDraw = []
        gameWithParent.addons.postDraw = []
        gameWithParent.parent()
    } finally {
        gameWithParent.addons.preDraw = preDrawAddonsBackup
        gameWithParent.addons.midDraw = midDrawAddonsBackup
        gameWithParent.addons.postDraw = postDrawAddonsBackup
        neutralize = false
    }
}
prestart(() => {
    ig.Renderer2d.inject({
        prepareDraw(...args) {
            if (neutralize) return
            return this.parent(...args)
        },
        drawLayers(...args) {
            if (neutralize) return
            return this.parent(...args)
        },
        drawPostLayerSprites() {
            if (neutralize) return
            return this.parent()
        },
    })
})

declare global {
    namespace ig.ENTITY {
        interface TeleportGround {
            multiMapRenderingEntry?: MultiMapRenderingMapInfoEntry
        }
    }
}
prestart(() => {
    ig.ENTITY.TeleportGround.inject({
        collideWith(entity, dir) {
            const entry = this.multiMapRenderingEntry
            if (
                !Opts.multiMapRendering ||
                !entry ||
                !(entity instanceof dummy.DummyPlayer) ||
                !(
                    this.map &&
                    ig.game.isPlayerTouch(this, entity, dir) &&
                    ig.game.isInterruptible() &&
                    !sc.model.isMapLeaveBlocked() &&
                    entity.coll.pos.z == this.coll.pos.z
                )
            ) {
                return this.parent(entity, dir)
            }

            const client = entity.getClient(true)
            if (!client) return this.parent(entity, dir)

            client.teleportOverrides.noBlackout = true

            client.teleportOverrides.pos = () => {
                const newPos = Vec2.create(entity.coll.pos)

                newPos.y -= entry.zDiff!

                Vec2.sub(newPos, entry.tpPosOffset!)
                Vec2.min(newPos, ig.game.size)
                Vec2.max(newPos, Vec2.create())

                return newPos
            }
            client.teleportOverrides.face = Vec2.create(entity.face)

            this.parent(entity, dir)

            const tpc = client.inst.ig.game.teleportColor
            tpc.timeIn = Math.min(tpc.timeIn, 0.3)
            tpc.timeOut = Math.min(tpc.timeOut, 0.3)

            if (entry.delay !== undefined) {
                tpc.timeIn = entry.delay
                tpc.timeOut = entry.delay
            }

            entity.animationFixed = true
        },
    })
}, 0 /* before colideWith fix inject */)

prestart(() => {
    function clamp(vec: Vec2, clampDiv: number = 1) {
        const clamps = ig.mapShared.multiMapRenderingMaps!.clamp
        const WEST = clamps.WEST.value + (clamps.WEST.func?.() ?? 0) == 0
        const EAST = clamps.EAST.value + (clamps.EAST.func?.() ?? 0) == 0
        const SOUTH = clamps.SOUTH.value + (clamps.SOUTH.func?.() ?? 0) == 0
        const NORTH = clamps.NORTH.value + (clamps.NORTH.func?.() ?? 0) == 0

        const width = ig.system.width
        const height = ig.system.height

        if (WEST) vec.x = Math.max(vec.x, width / 2 / clampDiv)
        if (EAST) vec.x = Math.min(vec.x, ig.game.size.x - width / 2 / clampDiv)

        if (SOUTH) vec.y = Math.min(vec.y, ig.game.size.y - height / 2 / clampDiv)
        if (NORTH) vec.y = Math.max(vec.y, height / 2 / clampDiv)

        return vec
    }
    ig.Camera.inject({
        _getNewPos(destPos: Vec2, destWantedPos?: Nullable<Vec2>, destZoom?: Vec2) {
            if (!ig.client || !ig.mapShared?.multiMapRenderingMaps || !Opts.multiMapRendering)
                return this.parent(destPos, destWantedPos, destZoom)

            let keepZoomFocusAligned = false
            if (this.targets.length > 0) {
                const target = this.targets[this.targets.length - 1]
                target.target.getPos(destPos)
                if (destZoom) {
                    destZoom.x = destPos.x + Math.round(target._currentZoomOffset.x)
                    destZoom.y = destPos.y + Math.round(target._currentZoomOffset.y)
                }
                destPos.x = destPos.x + Math.round(target._currentOffset.x)
                destPos.y = destPos.y + Math.round(target._currentOffset.y)
                keepZoomFocusAligned = target.keepZoomFocusAligned || false
            }
            if (destWantedPos) Vec2.assign(destWantedPos, destPos)

            if (this._cameraInBounds) {
                const zoom = keepZoomFocusAligned ? 1 : ig.system.zoom
                clamp(destPos, zoom)
                // destPos.x = destPos.x.limit(ig.system.width / 2 / zoom, ig.game.size.x - ig.system.width / 2 / zoom)
                // destPos.y = destPos.y.limit(ig.system.height / 2 / zoom, ig.game.size.y - ig.system.height / 2 / zoom)
            }
            if (!keepZoomFocusAligned && destZoom) Vec2.assign(destZoom, destPos)
            return destPos
        },

        _limitPos(pos: Vec2, zoom: Vec2, applyZoom: boolean) {
            if (!ig.client || !ig.mapShared?.multiMapRenderingMaps || !Opts.multiMapRendering)
                return this.parent(pos, zoom, applyZoom)

            const width = ig.system.width
            const height = ig.system.height

            // const xClamped = pos.x.limit(width / 2, ig.game.size.x - width / 2)
            // const yClamped = pos.y.limit(height / 2, ig.game.size.y - height / 2)

            const { x: xClamped, y: yClamped } = clamp(Vec2.create(pos))

            if (applyZoom) {
                const xZoomRatio = (zoom.x - (xClamped - width / 2)) / width
                const yZoomRatio = (zoom.y - (yClamped - height / 2)) / height

                const widthZoomAdjusted = width - width / ig.system.zoom
                const heightZoomAdjusted = height - height / ig.system.zoom

                let xOffset = 0
                let yOffset = 0

                if (xClamped > pos.x) {
                    const requiredOffset = xClamped - pos.x - widthZoomAdjusted * (0.5 - xZoomRatio)
                    xOffset = -Math.min(widthZoomAdjusted * xZoomRatio, requiredOffset)
                } else if (xClamped < pos.x) {
                    const n = pos.x - xClamped - widthZoomAdjusted * (xZoomRatio - 0.5)
                    xOffset = Math.min(widthZoomAdjusted * (1 - xZoomRatio), n)
                }

                if (yClamped > pos.y) {
                    const requiredOffset = yClamped - pos.y - heightZoomAdjusted * (0.5 - yZoomRatio)
                    yOffset = -Math.min(heightZoomAdjusted * yZoomRatio, requiredOffset)
                } else if (yClamped < pos.y) {
                    const requiredOffest = pos.y - yClamped - heightZoomAdjusted * (yZoomRatio - 0.5)
                    yOffset = Math.min(heightZoomAdjusted * (1 - yZoomRatio), requiredOffest)
                }

                pos.y = yClamped + yOffset
                pos.x = xClamped + xOffset

                zoom.y += yOffset
                zoom.x += xOffset
            } else {
                pos.x = xClamped
                pos.y = yClamped
            }
        },
    })
})

declare global {
    namespace ig {
        interface ChunkedMap {
            isParallax?: boolean
        }
    }
}
prestart(() => {
    ig.MAP.Background.inject({
        init(data, zHeight) {
            this.parent(data, zHeight)
            if (this.tilesetName?.includes('parallax')) this.isParallax = true
        },
    })
})
