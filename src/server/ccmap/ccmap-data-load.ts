import { waitForScheduledTask } from '../server'
import { prestart } from '../../plugin'

type Layer = keyof typeof ig.MAP
export function setDataFromLevelData(this: ig.Game, mapName: string, data: sc.MapModel.Map): Promise<void> {
    /* mostly stolen from ig.Game#loadLevel */

    ig.game.mapName = mapName
    ig.game.marker = ''
    for (const addon of this.addons.teleport) addon.onTeleport(mapName, new ig.TeleportPosition(), undefined)

    // this.currentLoadingResource = 'CREATING MAP:  ' + data.name
    ig.ready = false

    for (const addon of this.addons.levelLoadStart) addon.onLevelLoadStart(data)
    this.minLevelZ = 1e5
    this.maxLevel = data.levels.length
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
    let sizeX: number = 0
    let sizeY: number = 0
    for (let i = 0; i < data.layer.length; i++) {
        const layer = data.layer[i],
            level = layer.level || 0
        if (!layer.distance || layer.distance == 1) {
            sizeX = Math.max(sizeX, layer.tilesize * layer.width)
            sizeY = Math.max(sizeY, layer.tilesize * layer.height)
        }
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
    this.size.x = sizeX
    this.size.y = sizeY
    this.physics.mapCleared()
    this.physics.mapLoaded()

    for (const entity of data.entities) {
        const z = ig.game.getHeightFromLevelOffset(entity.level)
        ig.game.spawnEntity(entity.type, entity.x, entity.y, z, entity.settings)
    }
    this.renderer.mapCleared()

    let resolve: () => void
    const promise = new Promise<void>(res => (resolve = res))

    const loader = new (this.mapLoader || ig.Loader)()
    loader.onEnd = function (this: ig.Loader) {
        waitForScheduledTask(instanceinator.instances[this._instanceId], () => {
            /* this.finalize() */
            this.prevResourcesCnt = ig.resources.length
            ig.resources.length = 0
            clearInterval(this._intervalId)

            ig.ready = true

            ig.game.loadingComplete()

            this._loadCallbackBound = null
            ig.loading = false

            resolve()
        })
    }.bind(loader)

    loader.load()
    this.currentLoadingResource = loader

    /* stuff below from ig.Game#loadingComplete() */
    this.preDrawMaps()

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
            waitForScheduledTask(instanceinator.instances[this._instanceId], () => {
                this.loadingFinished(success)
            })
        },
    })
})
