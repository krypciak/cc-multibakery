import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { LocalServer, waitForScheduledTask } from './local-server'
import { assert } from '../misc/assert'
import { Player } from './player'
import { indent } from './local-server-console'
import { CCMapDisplay } from './ccmap-display'

export class CCMap {
    players: Player[] = []
    // playersThatJustLeft!: Player
    // private unloadTimeoutId!: NodeJS.Timeout

    inst!: InstanceinatorInstance
    display: CCMapDisplay

    constructor(
        public name: string,
        public alwaysLoaded: boolean = false
    ) {
        this.display = new CCMapDisplay(this)
    }

    async load() {
        assert(multi.server instanceof LocalServer)
        const displayMaps = multi.server.s.displayMaps

        const levelDataPromise = this.readLevelData()
        this.inst = await instanceinator.Instance.copy(multi.server.baseInst, `map-${this.name}`, displayMaps)
        instanceinator.append(this.inst)

        const levelData = await levelDataPromise
        this.inst.ig.game.scheduledTasks.push(() => {
            setDataFromLevelData.call(ig.game, this.name, levelData)

            sc.model.enterNewGame()
            sc.model.enterGame()

            this.display.setPosCameraHandle({ x: ig.game.size.x / 2, y: ig.game.size.y / 2 })
            this.display.removeUnneededGuis()
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
    }

    async enter(player: Player) {
        player.mapName = this.name
        this.players.push(player)
        // this.stopUnloadTimer()

        await this.enterEntity(player.dummy)
        this.display.onPlayerCountChange(true)
    }

    async leave(player: Player) {
        this.players.erase(player)

        // const packet = (UpdatePacketGather.state[this.name] ??= {})
        // const playersLeft = (packet.playersLeft ??= [])
        // playersLeft.push(player.dummy.uuid)

        // this.startUnloadTimer()
        await this.killEntity(player.dummy)
        this.display.onPlayerCountChange(false)
    }

    private async enterEntity(e: ig.Entity) {
        const promises: Promise<void>[] = []
        promises.push(
            waitForScheduledTask(this.inst, () => {
                const oldColl = e.coll
                e.coll = new ig.CollEntry(e)
                Vec3.assign(e.coll.pos, oldColl.pos)
                Vec3.assign(e.coll.size, oldColl.size)

                if (e.name) {
                    assert(!ig.game.namedEntities[e.mapId], 'map enterEntity namedEntities collision!')
                    ig.game.namedEntities[e.name] = e
                }
                if (e.mapId) {
                    assert(!ig.game.mapEntities[e.mapId], 'map enterEntity mapId collision!')
                    ig.game.mapEntities[e.mapId] = e
                }
                ig.game.entities.push(e)
                e._hidden = true
                e.show()
            })
        )
        if (e.isPlayer && e instanceof ig.ENTITY.Player && e.gui.crosshair) {
            promises.push(this.enterEntity(e.gui.crosshair))
        }
        await Promise.all(promises)
    }

    private async killEntity(e: ig.Entity) {
        const promises: Promise<void>[] = []
        promises.push(
            waitForScheduledTask(this.inst, () => {
                ig.game.entities.erase(e)
                delete ig.game.entitiesByUUID[e.uuid]
                e.clearEntityAttached()

                /* ig.game.removeEntity(e) */
                e.name && delete ig.game.namedEntities[e.name]

                // e._killed = e.coll._killed = true

                /* consequence of ig.game.detachEntity(e) */

                if (e.id) {
                    ig.game.physics.removeCollEntry(e.coll)
                    // this.physics.collEntryMap.forEach(a =>
                    //     a.forEach(a =>
                    //         a.forEach(c => {
                    //             if (c.entity === e) {
                    //                 a.erase(e.coll)
                    //             }
                    //         })
                    //     )
                    // )
                    /* reactivate it cuz removeCollEntry set it to false */
                    e.coll._active = true

                    ig.game.shownEntities[e.id] = null
                    // this.freeEntityIds.push(e.id)
                    // e.id = 0
                }
            })
        )

        if (e.isPlayer && e instanceof ig.ENTITY.Player) {
            promises.push(this.killEntity(e.gui.crosshair))
        }
        await Promise.all(promises)
    }

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

    toConsoleString(i: number = 0): string {
        let str = ''
        str += indent(i) + `map ${this.name}: {\n`
        if (this.display.cameraTarget) str += indent(i + 1) + this.display.toConsoleString()
        str += indent(i + 1) + `players: [\n`
        for (const player of this.players) str += player.toConsoleString(i + 2)
        str += indent(i + 1) + `]\n`
        str += indent(i) + `}\n`
        return str
    }
}

type Layer = keyof typeof ig.MAP
const setDataFromLevelData = function (this: ig.Game, mapName: string, data: sc.MapModel.Map) {
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
        instanceinator.instances[this.instanceId].ig.game.scheduledTasks.push(() => {
            /* this.finalize() */
            this.prevResourcesCnt = ig.resources.length
            ig.resources.length = 0
            clearInterval(this._intervalId)

            ig.ready = true
            ig.game.loadingComplete()

            this._loadCallbackBound = null
            ig.loading = false
        })
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
