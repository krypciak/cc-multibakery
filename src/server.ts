import { OnlineMap as CCMap } from './online-map'
import { Player } from './player'

export type ServerSettings = {
    name: string
    slotName: string
    host: string
    port: number
    globalTps: number
    entityTps: number
    physicsTps: number
    eventTps: number
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
        if (this.maps[mapName]) return this.maps[mapName]
        const map = new CCMap(mapName)
        await map.readLevelData()
        return map
    }

    private appendMap(map: CCMap) {
        this.maps[map.mapName] = map
    }

    async readAllMaps() {
        await Promise.all(Object.values(this.maps).map(m => m.readLevelData()))
    }

    async start() {
        await this.loadSlot()
        /* debug */
        this.appendMap(new CCMap('rhombus-dng/room-1', true))
        this.appendMap(new CCMap('rhombus-dng/room-1-5', true))

        await this.readAllMaps()

        sc.model.enterGame()
        sc.model.enterRunning()
        ig.game.prepareNewLevelView('rhombus-dng/room-1')
    }

    getPlayers(): Player[] {
        const players: Player[] = []
        for (const map of Object.values(this.maps)) {
            players.concat(map.players)
        }
        return players
    }

    async joinPlayer(player: Player) {
        const map = await this.getMap(player.mapName)
        map.enter(player)
        console.log('join!', player.name)
    }

    private findSlot(): number {
        return ig.storage.slots.findIndex(s => s.data.saveName == this.s.slotName)
    }

    private async loadSlot() {
        const slotIndex = this.findSlot()
        if (slotIndex == -1) {
            await this.createSlot(true)
        } else {
            ig.storage.loadSlot(0)
        }
        /* nuke interactables */
        ig.interact.entries.forEach(e => ig.interact.removeEntry(e))
    }

    private async createSlot(quitAfter: boolean, originMap: string = 'rhombus-dng.entrance', marker: string = 'start'): Promise<boolean> {
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
}
