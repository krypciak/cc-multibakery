import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../loading-stages'
import { type MapName } from '../../net/binary/binary-types'

type Layer = keyof typeof ig.MAP
export function initMapsAndLevels(this: ig.Game, data: sc.MapModel.Map) {
    this.minLevelZ = 1e5
    this.maxLevel = data.levels.length

    this.levels = {}
    this.levels.first = { maps: [] }
    for (let i = 0; i < data.levels.length; i++) {
        this.minLevelZ = Math.min(this.minLevelZ, data.levels[i].height)
        this.levels[i.toString()] = {
            height: data.levels[i].height,
            collision: ig.MAP.Collision.staticNoCollision,
            maps: [],
        }
    }
    this.levels.last = { maps: [] }
    this.levels.light = { maps: [] }
    this.levels.postlight = { maps: [] }
    this.levels.object1 = { maps: [] }
    this.levels.object2 = { maps: [] }
    this.levels.object3 = { maps: [] }
    this.masterLevel = data.masterLevel ? data.masterLevel.limit(0, this.maxLevel - 1) : 0
    for (const layer of data.layer) {
        const level = layer.level || 0
        const LayerConstructor = ig.MAP[layer.type as Layer]
        const layerClass = new LayerConstructor(layer, this.levels[level].height!)
        this.maps.push(layerClass)
        if ('levelKey' in LayerConstructor) {
            // @ts-expect-error i dont know anymore man
            this.levels[level][LayerConstructor.levelKey] = layerClass
        } else {
            /* this type cast below is always true */
            const layerClass1 = layerClass as Exclude<
                Exclude<Exclude<typeof layerClass, ig.MAP.HeightMap>, ig.MAP.Navigation>,
                ig.MAP.Collision
            >
            this.levels[level].maps!.push(layerClass1)
        }
    }

    let sizeX: number = 0
    let sizeY: number = 0
    for (const layer of data.layer) {
        if (!layer.distance || layer.distance == 1) {
            sizeX = Math.max(sizeX, layer.tilesize * layer.width)
            sizeY = Math.max(sizeY, layer.tilesize * layer.height)
        }
    }

    this.size.x = sizeX
    this.size.y = sizeY
}

export function setDataFromLevelData(this: ig.Game, mapName: MapName, data: sc.MapModel.Map): Promise<void> {
    /* mostly stolen from ig.Game#loadLevel */

    ig.game.mapName = mapName
    ig.game.marker = ''
    for (const addon of this.addons.teleport) addon.onTeleport(mapName, new ig.TeleportPosition(), undefined)

    // this.currentLoadingResource = 'CREATING MAP:  ' + data.name
    ig.ready = false

    for (const addon of this.addons.levelLoadStart) addon.onLevelLoadStart(data)

    ig.vars.onLevelChange(data.name)
    initMapsAndLevels.call(this, data)
    this.physics.mapCleared()
    this.physics.mapLoaded()

    for (const entity of data.entities) {
        const z = ig.game.getHeightFromLevelOffset(entity.level)
        ig.game.spawnEntity(entity.type, entity.x, entity.y, z, entity.settings)
    }
    this.renderer.mapCleared()

    const loader = new (this.mapLoader || ig.Loader)()
    const promise = new Promise<void>(resolve => {
        loader.onEnd = function (this: ig.Loader) {
            scheduleTask(instanceinator.instances[this._instanceId], () => {
                /* this.finalize() */
                this.prevResourcesCnt = ig.resources.length
                ig.resources.length = 0
                clearInterval(this._intervalId)

                ig.ready = true

                /* dont run ig.Game#loadingCompete since it runs onLevelLoaded addons */
                // ig.game.loadingComplete()
                // for (const addon of ig.game.addons.levelLoaded) addon.onLevelLoaded(ig.game)

                ig.game.preDrawMaps()
                ig.game.handleLoadingComplete()

                this._loadCallbackBound = null
                ig.loading = false

                resolve()
            })
        }.bind(loader)
    })

    loader.load()
    this.currentLoadingResource = loader

    /* stuff below from ig.Game#loadingComplete() */

    let collisionLayer: ig.MAP.Collision | undefined = this.levels[this.masterLevel].collision
    collisionLayer?.prepare()

    for (let i = this.masterLevel + 1; i < this.maxLevel; i++) {
        const level = this.levels[i]
        if (!level.collision!.prepare) throw new Error('level.collision!.prepare null????????')
        // if (level.collision!.prepare) {
        level.collision!.prepare(collisionLayer, collisionLayer ? (level.height! - this.levels[i - 1].height!) / 16 : 0)
        collisionLayer = level.collision
        // } else collisionLayer = undefined
    }
    collisionLayer = this.levels[this.masterLevel].collision // ? this.levels[this.masterLevel].collision : undefined
    for (let i = this.masterLevel - 1; i >= 0; i--) {
        const level = this.levels[i]
        if (!level.collision!.prepare) throw new Error('level.collision!.prepare null????????')
        level.collision!.prepare(collisionLayer, collisionLayer ? (level.height! - this.levels[i + 1].height!) / 16 : 0)
        collisionLayer = level.collision
    }

    return promise
}

prestart(() => {
    ig.Loadable.inject({
        loadingFinished(success) {
            if (this._instanceId == instanceinator.id) {
                return this.parent(success)
            }
            if (success) this.loaded = true
            else this.failed = true
            runTask(instanceinator.instances[this._instanceId], () => {
                this.loadingFinished(success)
            })
        },
    })
})

prestart(() => {
    sc.CrossCode.inject({
        handleLoadingComplete() {
            if (!multi.server) return this.parent()
            if (!ig.game.playerEntity) return
            const backup = ig.overlay
            ig.overlay = { setAlpha() {} } as any
            this.parent()
            ig.overlay = backup
        },
    })
})
