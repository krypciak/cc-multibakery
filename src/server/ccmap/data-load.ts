import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../loading-stages'
import { profile } from '../../misc/profile-decorator'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

type Layer = keyof typeof ig.MAP

export class MapDataLoad {
    static initMapsAndLevels(data: sc.MapModel.Map) {
        const game = ig.game
        game.minLevelZ = 1e5
        game.maxLevel = data.levels.length

        game.levels = {}
        game.levels.first = { maps: [] }
        for (let i = 0; i < data.levels.length; i++) {
            game.minLevelZ = Math.min(game.minLevelZ, data.levels[i].height)
            game.levels[i.toString()] = {
                height: data.levels[i].height,
                collision: ig.MAP.Collision.staticNoCollision,
                maps: [],
            }
        }
        game.levels.last = { maps: [] }
        game.levels.light = { maps: [] }
        game.levels.postlight = { maps: [] }
        game.levels.object1 = { maps: [] }
        game.levels.object2 = { maps: [] }
        game.levels.object3 = { maps: [] }
        game.masterLevel = data.masterLevel ? data.masterLevel.limit(0, game.maxLevel - 1) : 0
        for (const layer of data.layer) {
            const level = layer.level || 0
            const LayerConstructor = ig.MAP[layer.type as Layer]
            const layerClass = new LayerConstructor(layer, game.levels[level].height!)
            game.maps.push(layerClass)
            if ('levelKey' in LayerConstructor) {
                // @ts-expect-error i dont know anymore man
                game.levels[level][LayerConstructor.levelKey] = layerClass
            } else {
                /* this type cast below is always true */
                const layerClass1 = layerClass as Exclude<
                    Exclude<Exclude<typeof layerClass, ig.MAP.HeightMap>, ig.MAP.Navigation>,
                    ig.MAP.Collision
                >
                game.levels[level].maps!.push(layerClass1)
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

        game.size.x = sizeX
        game.size.y = sizeY
    }

    private static prepareCollision() {
        const game = ig.game
        let collisionLayer: ig.MAP.Collision | undefined = game.levels[game.masterLevel].collision
        collisionLayer?.prepare()

        for (let i = game.masterLevel + 1; i < game.maxLevel; i++) {
            const level = game.levels[i]
            level.collision!.prepare(
                collisionLayer,
                collisionLayer ? (level.height! - game.levels[i - 1].height!) / 16 : 0
            )
            collisionLayer = level.collision
        }
        collisionLayer = game.levels[game.masterLevel].collision
        for (let i = game.masterLevel - 1; i >= 0; i--) {
            const level = game.levels[i]
            level.collision!.prepare(
                collisionLayer,
                collisionLayer ? (level.height! - game.levels[i + 1].height!) / 16 : 0
            )
            collisionLayer = level.collision
        }
    }

    @profile((_self, _data, mapName: string) => `${mapName}`)
    static setMapDataFromLevelData(data: sc.MapModel.Map, mapName: string) {
        const game = ig.game
        /* mostly stolen from ig.Game#loadLevel */

        ig.game.mapName = mapName
        ig.game.marker = ''
        for (const addon of game.addons.teleport) addon.onTeleport(mapName, new ig.TeleportPosition(), undefined)

        // this.currentLoadingResource = 'CREATING MAP:  ' + data.name
        ig.ready = false

        for (const addon of game.addons.levelLoadStart) addon.onLevelLoadStart(data)

        ig.vars.onLevelChange(data.name)
        MapDataLoad.initMapsAndLevels(data)
        game.physics.mapCleared()
        game.physics.mapLoaded()

        for (const entity of data.entities) {
            const z = ig.game.getHeightFromLevelOffset(entity.level)
            ig.game.spawnEntity(entity.type, entity.x, entity.y, z, entity.settings)
        }
        game.renderer.mapCleared()
    }

    @profile((_self, inst) => `${inst.ig.game.mapName}`)
    private static async onLoadingComplete(inst: InstanceinatorInstance, loader: ig.Loader) {
        await scheduleTask(inst, () => {
            /* this.finalize() */
            loader.prevResourcesCnt = ig.resources.length
            ig.resources.length = 0
            clearInterval(loader._intervalId)

            ig.ready = true

            ig.game.preDrawMaps()
            // ig.game.loadingComplete()
            MapDataLoad.prepareCollision()

            for (const addon of ig.game.addons.levelLoaded) addon.onLevelLoaded(ig.game)
            ig.game.handleLoadingComplete()

            loader._loadCallbackBound = null
            ig.loading = false
        })
    }

    @profile(() => `${ig.game.mapName}`)
    private static startLoaderAndWait(loader: ig.Loader) {
        return new Promise<void>(resolve => {
            loader.onEnd = () => {
                resolve()
            }

            loader.load()
            ig.game.currentLoadingResource = loader
        })
    }

    static async loadMapResources() {
        const inst = instanceinator.instances[instanceinator.id]
        const loader = new (ig.game.mapLoader || ig.Loader)()
        await this.startLoaderAndWait(loader)
        await this.onLoadingComplete(inst, loader)
    }
}

prestart(() => {
    ig.Loadable.inject({
        loadingFinished(success) {
            if (this._instanceId == instanceinator.id) {
                return this.parent(success)
            }
            if (success) this.loaded = true
            else this.failed = true
            const inst = instanceinator.instances[this._instanceId]
            if (!inst) return
            runTask(inst, () => {
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
