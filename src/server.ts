import { PlayerJoinResponse, ServerSettingsBase, FromClientUpdatePacket } from './api'
import { CCMap as CCMap } from './ccmap'
import { getInitialState } from './state/initial'
import { Player } from './player'
import { teleportPlayerToProperMarker } from './teleport-fix'

export interface ServerSettings extends ServerSettingsBase {
    slotName: string
    host: string
    port: number
}

export class CCServer {
    maps: Record<string, CCMap> = {}

    currentMapViewName: string = ''

    get viewMap(): CCMap {
        return this.maps[this.currentMapViewName]
    }

    constructor(public s: ServerSettings) {
        ig.multiplayer.appendServer(this)
    }

    async getMap(mapName: string): Promise<CCMap> {
        mapName = mapName.toPath('', '')
        if (this.maps[mapName]) return this.maps[mapName]
        const map = new CCMap(mapName)
        await map.readLevelData()
        this.appendMap(map)
        return map
    }

    private appendMap(map: CCMap) {
        this.maps[map.mapName] = map
    }

    unloadMap(map: CCMap) {
        delete this.maps[map.mapName]
    }

    getActiveMaps(): CCMap[] {
        return Object.values(this.maps).filter(
            map => map.players.length > 0 || ig.multiplayer.server.currentMapViewName == map.mapName || map.alwaysLoaded
        )
    }

    async start() {
        await this.loadSlot()

        /* debug */
        ig.game.mapName = 'rhombus-dng.room-1'
        ig.game.marker = 'start'

        sc.model.enterGame()
        sc.model.enterRunning()
        this.prepareNewLevelView(ig.game.mapName, new ig.TeleportPosition(ig.game.marker))

        // @ts-expect-error
        window.s = this
    }

    getPlayers(): Player[] {
        const players: Player[] = []
        for (const map of this.getActiveMaps()) {
            players.push(...map.players)
        }
        return players
    }

    getPlayerByEntity(e: ig.dummy.DummyPlayer): Player {
        return this.getPlayers().find(p => p.dummy === e)!
    }

    async joinPlayer(player: Player): Promise<PlayerJoinResponse> {
        if (this.getPlayers().some(p => p.name == player.name)) return { usernameTaken: true }

        const mapName = player.mapName
        const map = await this.getMap(mapName)
        await map.enter(player)
        /* debug */
        const pos = ig.game.playerEntity.coll.pos
        player.dummy.setPos(pos.x, pos.y, pos.z)
        console.log('join', player.name)
        return {
            mapName,
            serverSettings: {
                name: this.s.name,
                globalTps: this.s.globalTps,
                rollback: this.s.rollback,
                clientStateCorrection: this.s.clientStateCorrection,
                godmode: this.s.godmode,
            },
            state: getInitialState(map),
        }
    }

    leavePlayer(player: Player) {
        player.disconnect()
        /* save data todo */
    }

    async playerUpdate(player: Player, packet: FromClientUpdatePacket) {
        const map = this.maps[player.mapName]
        if (!map) return
        map.scheduledPacketsForUpdate.push({ player, packet })
    }

    private findSlot(): number {
        return ig.storage.slots.findIndex(s => s.data.saveName == this.s.slotName)
    }

    private async loadSlot() {
        const slotIndex = this.findSlot()
        if (slotIndex == -1) {
            await this.createSlot(true)
        } else {
            ig.storage.loadSlot(slotIndex)
        }
        /* nuke interactables */
        ig.interact.entries.forEach(e => ig.interact.removeEntry(e))
    }

    private async createSlot(
        quitAfter: boolean,
        originMap: string = 'rhombus-dng.entrance',
        marker: string = 'start'
    ): Promise<boolean> {
        const name = this.s.name
        console.log(`creating a new slot: ${name} ${originMap}@${marker}`)
        ig.game.start()
        ig.game.transitionTimer = 0
        ig.game.teleport(originMap, new ig.TeleportPosition(marker))

        sc.menu.newSlot()
        const id = 0
        ig.storage.slots[id].data.saveName = name
        const newSlot = new ig.SaveSlot(ig.storage.slots[id].data)
        ig.storage.slots[id] = newSlot
        ig.storage._saveToStorage()

        if (!quitAfter) return false

        return new Promise<boolean>(resolve => {
            setTimeout(() => {
                sc.model.enterReset()
                sc.model.enterRunning()
                ig.game.reset()
                sc.model.enterTitle()
                resolve(true)
            }, 3e3)
        })
    }

    async prepareNewLevelView(mapName: string, tpPos?: ig.TeleportPosition) {
        mapName = mapName.toPath('', '')
        const previousMap = this.maps[this.currentMapViewName]
        this.currentMapViewName = mapName

        if (previousMap) {
            previousMap.killEntity(ig.game.playerEntity)
            previousMap.startUnloadTimer()
        }

        const map = await this.getMap(mapName)
        map.stopUnloadTimer()
        map.prepareForUpdate()

        /* set the viewer skin to junolea, wont crash if the junolea skin isnt installed */
        sc.playerSkins.currentSkins['Appearance'] = sc.playerSkins._createSkin('junolea')

        ig.imageAtlas.defragment()
        ig.ready = false

        /* modified ig.game.createPlayer() */
        ig.game.playerEntity = ig.game.spawnEntity(ig.ENTITY.Player, 0, 0, 0, {})

        teleportPlayerToProperMarker(ig.game.playerEntity, ig.game.marker, tpPos, true)

        ig.ready = true

        const loader = new (ig.game.mapLoader || ig.Loader)()
        loader.load()
        ig.game.currentLoadingResource = loader

        map.afterUpdate()

        ig.godmode()

        for (const player of this.getPlayers()) {
            player.dummy.hideUsernameBox()
        }
        for (const player of map.players) {
            player.dummy.showUsernameBox()
        }
    }
}
