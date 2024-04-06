import { PlayerClass } from './server'

export class OnlineMap {
    private _levelData!: sc.MapModel.Map
    get levelData(): sc.MapModel.Map {
        return this._levelData
    }

    private conditionalEntities!: typeof ig.game.conditionalEntities
    private shownEntities!: typeof ig.game.shownEntities
    private namedEntities!: typeof ig.game.namedEntities
    private mapEntities!: typeof ig.game.mapEntities
    private entities!: typeof ig.game.entities
    private freeEntityIds!: typeof ig.game.freeEntityIds

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

    players!: PlayerClass[]

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
        this.namedEntities = []
        this.mapEntities = []
        this.entities = []
        this.freeEntityIds = []

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
        setDataFromLevelData.bind(ig.game)(data)
        this.afterUpdate()
    }

    public enter(player: PlayerClass) {
        this.players.push(player)
    }

    public leave(player: PlayerClass): boolean {
        this.players.erase(player)
        return this.players.length == 0
    }

    public prepareForUpdate() {
        ig.game.conditionalEntities = this.conditionalEntities
        ig.game.shownEntities = this.shownEntities
        ig.game.namedEntities = this.namedEntities
        ig.game.mapEntities = this.mapEntities
        ig.game.entities = this.entities
        ig.game.freeEntityIds = this.freeEntityIds

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

        ig.vars.onLevelChange(this.mapName)
    }

    public afterUpdate() {
        this.masterLevel = ig.game.masterLevel
        this.maxLevel = ig.game.maxLevel
        this.minLevelZ = ig.game.minLevelZ
        this._deferredVarChanged = ig.game._deferredVarChanged
    }
}

type Layer = keyof typeof ig.MAP
const setDataFromLevelData = function (this: ig.Game, data: sc.MapModel.Map) {
    /* mostly stolen from ig.Game#loadLevel */

    for (const addon of this.addons.levelLoadStart) addon.onLevelLoadStart(data)
    this.minLevelZ = 1e5
    this.maxLevel = data.levels.length
    this.levels.first = { maps: [] }
    for (let i = 0; i < data.levels.length; i++) {
        this.minLevelZ = Math.min(this.minLevelZ, data.levels[i].height)
        this.levels['' + i] = { height: data.levels[i].height, collision: ig.MAP.Collision.staticNoCollision, maps: [] }
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
            const layerClass1 = layerClass as Exclude<Exclude<Exclude<typeof layerClass, ig.MAP.HeightMap>, ig.MAP.Navigation>, ig.MAP.Collision>
            this.levels[level].maps!.push(layerClass1)
        }
    }
    this.size.x = sizeX
    this.size.y = sizeY
    this.physics.mapLoaded()
    for (let i = 0; i < data.entities.length; i++) {
        const entity = data.entities[i]
        const z = this.getHeightFromLevelOffset(entity.level)
        ig.game.spawnEntity(entity.type, entity.x, entity.y, z, entity.settings)
    }

    // @ts-expect-error
    this.renderer.mapCleared()
}
