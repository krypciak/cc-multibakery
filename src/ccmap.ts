import { FromClientUpdatePacket } from './api'
import { assert } from './misc/assert'
import { Player } from './player'
import { UpdatePacketGather } from './update-packet-gather'

export class VarBackup {
    private static inst: VarBackup = new VarBackup()
    public static backup() {
        this.inst.backup()
    }
    public static restore() {
        this.inst.restore()
    }

    private mapName!: string

    private conditionalEntities!: typeof ig.game.conditionalEntities
    private shownEntities!: typeof ig.game.shownEntities
    private namedEntities!: typeof ig.game.namedEntities
    private mapEntities!: typeof ig.game.mapEntities
    entities!: typeof ig.game.entities
    private freeEntityIds!: typeof ig.game.freeEntityIds
    private entitiesByUUID!: typeof ig.game.entitiesByUUID

    private renderer!: typeof ig.game.renderer
    private physics!: typeof ig.game.physics
    private events!: typeof ig.game.events
    private levels!: typeof ig.game.levels
    private maps!: typeof ig.game.maps
    private masterLevel!: typeof ig.game.masterLevel
    private maxLevel!: typeof ig.game.maxLevel
    private minLevelZ!: typeof ig.game.minLevelZ
    private screen!: typeof ig.game.screen
    private size!: typeof ig.game.size
    private states!: typeof ig.game.states
    private _deferredVarChanged!: typeof ig.game._deferredVarChanged

    private vars!: typeof ig.vars

    private bounceSwitchGroups!: typeof sc.bounceSwitchGroups

    private restored: boolean = true

    public backup() {
        assert(this.restored, 'Backup called without restoring!')
        assert(multi.nowServer, 'Backup called when multi.nowServer is false!')
        this.restored = false

        this.conditionalEntities = ig.game.conditionalEntities
        this.shownEntities = ig.game.shownEntities
        this.namedEntities = ig.game.namedEntities
        this.mapEntities = ig.game.mapEntities
        this.entities = ig.game.entities
        this.freeEntityIds = ig.game.freeEntityIds
        this.entitiesByUUID = ig.game.entitiesByUUID

        this.renderer = ig.game.renderer
        this.physics = ig.game.physics
        this.events = ig.game.events
        this.levels = ig.game.levels
        this.maps = ig.game.maps
        this.masterLevel = ig.game.masterLevel
        this.maxLevel = ig.game.maxLevel
        this.minLevelZ = ig.game.minLevelZ
        this.screen = ig.game.screen
        this.size = ig.game.size
        this.states = ig.game.states
        this._deferredVarChanged = ig.game._deferredVarChanged
        this.mapName = ig.game.mapName

        this.bounceSwitchGroups = sc.bounceSwitchGroups

        this.vars = ig.vars
    }

    public restore() {
        assert(!this.restored, 'Restore called without backing up!')
        assert(multi.nowClient, 'Restore called when multi.nowClient is false!')
        this.restored = true

        ig.game.conditionalEntities = this.conditionalEntities
        ig.game.shownEntities = this.shownEntities
        ig.game.namedEntities = this.namedEntities
        ig.game.mapEntities = this.mapEntities
        ig.game.entities = this.entities
        ig.game.freeEntityIds = this.freeEntityIds
        ig.game.entitiesByUUID = this.entitiesByUUID

        ig.game.renderer = this.renderer
        ig.game.physics = this.physics
        ig.game.events = this.events
        ig.game.levels = this.levels
        ig.game.maps = this.maps
        ig.game.masterLevel = this.masterLevel
        ig.game.maxLevel = this.maxLevel
        ig.game.minLevelZ = this.minLevelZ
        ig.game.screen = this.screen
        ig.game.size = this.size
        ig.game.states = this.states
        ig.game._deferredVarChanged = this._deferredVarChanged
        ig.game.mapName = this.mapName

        sc.bounceSwitchGroups = this.bounceSwitchGroups

        ig.vars = this.vars
    }
}

export class CCMap {
    private _levelData!: sc.MapModel.Map
    get levelData(): sc.MapModel.Map {
        return this._levelData
    }

    private conditionalEntities!: typeof ig.game.conditionalEntities
    private shownEntities!: typeof ig.game.shownEntities
    private namedEntities!: typeof ig.game.namedEntities
    private mapEntities!: typeof ig.game.mapEntities
    entities!: typeof ig.game.entities
    private freeEntityIds!: typeof ig.game.freeEntityIds
    private entitiesByUUID!: typeof ig.game.entitiesByUUID

    private renderer!: typeof ig.game.renderer
    private physics!: typeof ig.game.physics
    private events!: typeof ig.game.events
    private levels!: typeof ig.game.levels
    private maps!: typeof ig.game.maps
    private masterLevel!: typeof ig.game.masterLevel
    private maxLevel!: typeof ig.game.maxLevel
    private minLevelZ!: typeof ig.game.minLevelZ
    private screen!: typeof ig.game.screen
    private size!: typeof ig.game.size
    private states!: typeof ig.game.states
    private _deferredVarChanged!: typeof ig.game._deferredVarChanged

    /* vars under ig.vars.storage */
    private Vtmp: typeof ig.vars.storage.tmp

    private bounceSwitchGroups!: typeof sc.bounceSwitchGroups

    players!: Player[]
    playersThatJustLeft!: Player
    private unloadTimeoutId!: NodeJS.Timeout

    scheduledPacketsForUpdate!: { player: Player; packet: FromClientUpdatePacket }[]
    scheduledFunctionsForUpdate!: (() => void)[]

    constructor(
        public mapName: string,
        public alwaysLoaded: boolean = false
    ) {
        this.reset()
    }

    private reset() {
        this.players = []
        this.conditionalEntities = []
        this.shownEntities = []
        this.namedEntities = {}
        this.mapEntities = []
        this.entities = []
        this.freeEntityIds = []
        this.entitiesByUUID = {}

        this.renderer = new ig.Renderer2d()
        this.physics = new ig.Physics()
        this.events = new ig.EventManager()
        this.levels = {}
        this.maps = []
        this.masterLevel = 0
        this.maxLevel = 0
        this.minLevelZ = 0
        this.screen = Vec2.create()
        this.size = Vec2.create()
        this.states = []
        this._deferredVarChanged = false

        this.scheduledPacketsForUpdate = []
        this.scheduledFunctionsForUpdate = []

        this.Vtmp = {}

        this.bounceSwitchGroups = new sc.BounceSwitchGroups()
    }

    public async readLevelData() {
        const data = await new Promise<sc.MapModel.Map>(resolve => {
            $.ajax({
                dataType: 'json',
                url: ig.getFilePath(this.mapName.toPath(ig.root + 'data/maps/', '.json') + ig.getCacheSuffix()),
                context: this,
                success: resolve,
                error: (b, c, e) => {
                    ig.system.error(Error("Loading of Map '" + this.mapName + "' failed: " + b + ' / ' + c + ' / ' + e))
                },
            })
        })
        this._levelData = data
        this.prepareForUpdate()
        await setDataFromLevelData.bind(ig.game)(data)
        this.afterUpdate()
    }

    public async enter(player: Player): Promise<void> {
        player.mapName = this.mapName
        this.players.push(player)
        this.stopUnloadTimer()

        return this.enterEntity(player.dummy)
    }

    public leave(player: Player) {
        this.players.erase(player)
        this.killEntity(player.dummy)

        const packet = (UpdatePacketGather.state[this.mapName] ??= {})
        const playersLeft = (packet.playersLeft ??= [])
        playersLeft.push(player.dummy.uuid)

        this.startUnloadTimer()
    }

    private enterEntity(e: ig.Entity): Promise<void> {
        return new Promise<void>(resolve => {
            this.scheduledFunctionsForUpdate.push(() => {
                const oldColl = e.coll
                e.coll = new ig.CollEntry(e)
                Vec3.assign(e.coll.pos, oldColl.pos)
                Vec3.assign(e.coll.size, oldColl.size)

                if (e.name) this.namedEntities[e.name] = e
                this.entities.push(e)
                if (e.mapId) this.mapEntities[e.mapId] = e
                e._hidden = true
                e.show()

                if (e.isPlayer && e instanceof ig.ENTITY.Player) {
                    this.enterEntity(e.gui.crosshair)
                }
                resolve()
            })
        })
    }

    public killEntity(e: ig.Entity) {
        this.scheduledFunctionsForUpdate.push(() => {
            this.entities.erase(e)
            delete this.entitiesByUUID[e.uuid]
            e.clearEntityAttached()

            /* ig.game.removeEntity(e) */
            e.name && delete this.namedEntities[e.name]

            // e._killed = e.coll._killed = true

            /* consequence of ig.game.detachEntity(e) */

            if (e.id) {
                this.physics.removeCollEntry(e.coll)
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

                this.shownEntities[e.id] = null
                // this.freeEntityIds.push(e.id)
                // e.id = 0
            }
            if (e.isPlayer && e instanceof ig.ENTITY.Player) {
                this.killEntity(e.gui.crosshair)
            }
        })
    }

    public startUnloadTimer() {
        if (this.alwaysLoaded || this.players.length != 0) return

        const waitTime = multi.server.s.unloadInactiveMapsMs
        if (waitTime === undefined || waitTime == -1) return

        this.unloadTimeoutId = setTimeout(() => {
            multi.server.unloadMap(this)
        }, waitTime)
    }
    public stopUnloadTimer() {
        if (this.unloadTimeoutId) clearTimeout(this.unloadTimeoutId)
    }

    public prepareForUpdate() {
        ig.game.conditionalEntities = this.conditionalEntities
        ig.game.shownEntities = this.shownEntities
        ig.game.namedEntities = this.namedEntities
        ig.game.mapEntities = this.mapEntities
        ig.game.entities = this.entities
        ig.game.freeEntityIds = this.freeEntityIds
        ig.game.entitiesByUUID = this.entitiesByUUID

        ig.game.renderer = this.renderer
        ig.game.physics = this.physics
        ig.game.events = this.events
        ig.game.levels = this.levels
        ig.game.maps = this.maps
        ig.game.masterLevel = this.masterLevel
        ig.game.maxLevel = this.maxLevel
        ig.game.minLevelZ = this.minLevelZ
        ig.game.screen = this.screen
        ig.game.size = this.size
        ig.game.states = this.states
        ig.game._deferredVarChanged = this._deferredVarChanged
        ig.game.mapName = this.mapName

        /* manual implementation of ig.vars.onLevelChange(this.mapName) */
        const varMapName = this.mapName.toCamel().toPath('', '')
        ig.vars.currentLevelName = varMapName
        ig.vars.storage.map = ig.vars.storage.maps[varMapName] ??= {}
        ig.vars.storage.tmp = this.Vtmp

        if (!ig.vars.storage.session.maps[varMapName]) ig.vars.storage.session.maps[varMapName] = {}
        ig.vars.storage.session.map = ig.vars.storage.session.maps[varMapName]

        sc.bounceSwitchGroups = this.bounceSwitchGroups
    }

    public afterUpdate() {
        this.masterLevel = ig.game.masterLevel
        this.maxLevel = ig.game.maxLevel
        this.minLevelZ = ig.game.minLevelZ
        this._deferredVarChanged = ig.game._deferredVarChanged
        this.size = ig.game.size

        // @ts-expect-error
        ig.game.events = {
            callEvent(event, runType) {
                console.log('callEvent', event, runType)
                return {} as any
            },
        }
        // @ts-expect-error
        sc.bounceSwitchGroups = undefined
    }
}

type Layer = keyof typeof ig.MAP
const setDataFromLevelData = async function (this: ig.Game, data: sc.MapModel.Map) {
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
    collisionLayer = this.levels[this.masterLevel].collision ? this.levels[this.masterLevel].collision : undefined
    for (let i = this.masterLevel - 1; i >= 0; i--) {
        const level = this.levels[i]
        if (!level.collision!.prepare) throw new Error('level.collision!.prepare null????????')
        level.collision!.prepare(collisionLayer, collisionLayer ? (level.height! - this.levels[i + 1].height!) / 16 : 0)
        collisionLayer = level.collision
    }
}
