import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { LocalServer } from './local-server'
import { assert } from '../misc/assert'

export class CCMap {
    static displayMaps: boolean = true
    // players!: Player[]
    // playersThatJustLeft!: Player
    // private unloadTimeoutId!: NodeJS.Timeout

    inst!: InstanceinatorInstance

    constructor(
        public name: string,
        public alwaysLoaded: boolean = false
    ) {}

    async load() {
        assert(multi.server instanceof LocalServer)
        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.Instance.copy(multi.server.baseInst, `map-${this.name}`, CCMap.displayMaps)
        instanceinator.append(this.inst)

        const levelData = await levelDataPromise
        this.inst.ig.game.scheduledTasks.push(() => {
            setDataFromLevelData.call(ig.game, levelData)
        })
    }
    async unload() {}

    private async readLevelData() {
        return new Promise<sc.MapModel.Map>(resolve => {
            $.ajax({
                dataType: 'json',
                url: ig.getFilePath(this.name.toPath(ig.root + 'data/maps/', '.json') + ig.getCacheSuffix()),
                context: this,
                success: resolve,
                error: (b, c, e) => {
                    ig.system.error(Error("Loading of Map '" + this.name + "' failed: " + b + ' / ' + c + ' / ' + e))
                },
            })
        })
        // this._levelData = data
        // this.prepareForUpdate()
        // await setDataFromLevelData.bind(ig.game)(data)
        // this.afterUpdate()
    }

    // public async enter(player: Player): Promise<void> {
    //     player.mapName = this.name
    //     this.players.push(player)
    //     this.stopUnloadTimer()
    //
    //     return this.enterEntity(player.dummy)
    // }
    //
    // public leave(player: Player) {
    //     this.players.erase(player)
    //     this.killEntity(player.dummy)
    //
    //     const packet = (UpdatePacketGather.state[this.name] ??= {})
    //     const playersLeft = (packet.playersLeft ??= [])
    //     playersLeft.push(player.dummy.uuid)
    //
    //     this.startUnloadTimer()
    // }
    //
    // private enterEntity(e: ig.Entity): Promise<void> {
    //     return new Promise<void>(resolve => {
    //         this.scheduledFunctionsForUpdate.push(() => {
    //             const oldColl = e.coll
    //             e.coll = new ig.CollEntry(e)
    //             Vec3.assign(e.coll.pos, oldColl.pos)
    //             Vec3.assign(e.coll.size, oldColl.size)
    //
    //             if (e.name) this.namedEntities[e.name] = e
    //             this.entities.push(e)
    //             if (e.mapId) this.mapEntities[e.mapId] = e
    //             e._hidden = true
    //             e.show()
    //
    //             if (e.isPlayer && e instanceof ig.ENTITY.Player) {
    //                 this.enterEntity(e.gui.crosshair)
    //             }
    //             resolve()
    //         })
    //     })
    // }
    //
    // public killEntity(e: ig.Entity) {
    //     this.scheduledFunctionsForUpdate.push(() => {
    //         this.entities.erase(e)
    //         delete this.entitiesByUUID[e.uuid]
    //         e.clearEntityAttached()
    //
    //         /* ig.game.removeEntity(e) */
    //         e.name && delete this.namedEntities[e.name]
    //
    //         // e._killed = e.coll._killed = true
    //
    //         /* consequence of ig.game.detachEntity(e) */
    //
    //         if (e.id) {
    //             this.physics.removeCollEntry(e.coll)
    //             // this.physics.collEntryMap.forEach(a =>
    //             //     a.forEach(a =>
    //             //         a.forEach(c => {
    //             //             if (c.entity === e) {
    //             //                 a.erase(e.coll)
    //             //             }
    //             //         })
    //             //     )
    //             // )
    //             /* reactivate it cuz removeCollEntry set it to false */
    //             e.coll._active = true
    //
    //             this.shownEntities[e.id] = null
    //             // this.freeEntityIds.push(e.id)
    //             // e.id = 0
    //         }
    //         if (e.isPlayer && e instanceof ig.ENTITY.Player) {
    //             this.killEntity(e.gui.crosshair)
    //         }
    //     })
    // }
    //
    // public startUnloadTimer() {
    //     return
    //     // if (this.alwaysLoaded || this.players.length != 0) return
    //     //
    //     // const waitTime = multi.server.s.unloadInactiveMapsMs
    //     // if (waitTime === undefined || waitTime == -1) return
    //     //
    //     // this.unloadTimeoutId = setTimeout(() => {
    //     //     multi.server.unloadMap(this)
    //     // }, waitTime)
    // }
    // public stopUnloadTimer() {
    //     if (this.unloadTimeoutId) clearTimeout(this.unloadTimeoutId)
    // }
}

type Layer = keyof typeof ig.MAP
const setDataFromLevelData = function (this: ig.Game, data: sc.MapModel.Map) {
    /* mostly stolen from ig.Game#loadLevel */

    // this.currentLoadingResource = 'CREATING MAP:  ' + data.name
    ig.ready = false

    // for (const addon of this.addons.levelLoadStart) addon.onLevelLoadStart(data)
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
    // this.physics.mapCleared()
    this.physics.mapLoaded()
    for (let i = 0; i < data.entities.length; i++) {
        const entity = data.entities[i]
        const z = this.getHeightFromLevelOffset(entity.level)
        ig.game.spawnEntity(entity.type, entity.x, entity.y, z, entity.settings)
    }

    this.renderer.mapCleared()

    const loader = new (this.mapLoader || ig.Loader)()
    loader.onEnd = function (this: ig.Loader) {
        /* this.finalize() */
        this.prevResourcesCnt = ig.resources.length
        ig.resources.length = 0
        clearInterval(this._intervalId)

        ig.ready = true
        // ig.game.loadingComplete()

        this._loadCallbackBound = null
        ig.loading = false
    }.bind(loader)

    loader.load()
    this.currentLoadingResource = loader

    /* stuff below from ig.Game#loadingComplete() */
    if (!multi.headless) this.preDrawMaps()

    let collisionLayer: ig.MAP.Collision | undefined = this.levels[this.masterLevel].collision
    if (collisionLayer) collisionLayer.prepare()

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
}
