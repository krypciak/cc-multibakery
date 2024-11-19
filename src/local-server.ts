import { ClientJoinResponse, FromClientUpdatePacket } from './api'
import { CCMap as CCMap } from './ccmap'
import { emptyGatherInput } from './dummy-player'
import { Client } from './local-client'
import { getInitialState } from './state/initial'

export interface ServerSettings {
    name: string
    globalTps: number
    godmode?: boolean
}

export interface Server<T extends ServerSettings = ServerSettings> {
    s: T

    joinClient(client: Client): Promise<ClientJoinResponse>
    getUsernames(): Promise<string[]>

    receiveDataFromClient(username: string, packet: FromClientUpdatePacket): void
}

export interface LocalServerSettings extends ServerSettings {
    slotName: string
    host: string
    port: number

    unloadInactiveMapsMs?: number /* set to -1 to diable unloading inactive maps */
}

export class LocalServer implements Server<LocalServerSettings> {
    maps: Record<string, CCMap> = {}

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

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
        return Object.values(this.maps).filter(map => map.players.length > 0 || map.alwaysLoaded)
    }

    async start() {
        await this.loadSlot()

        // ig.game.mapName = 'rhombus-dng.room-1'
        // ig.game.marker = 'start'

        // sc.model.enterGame()
        // sc.model.enterRunning()
    }

    async joinClient(client: Client): Promise<ClientJoinResponse> {
        if (this.clients[client.player.name]) return { usernameTaken: true }
        this.clients[client.player.name] = client

        const mapName = client.player.mapName
        const map = await this.getMap(mapName)
        await map.enter(client.player)

        /* debug */
        // client.player.dummy.setPos(360, 280, 0)

        console.log('join', client.player.name)
        return {
            mapName,
            serverSettings: {
                name: this.s.name,
                globalTps: this.s.globalTps,
                godmode: this.s.godmode,
            },
            state: getInitialState(map),
        }
    }

    async getUsernames(): Promise<string[]> {
        return Object.keys(this.clients)
    }

    receiveDataFromClient(username: string, packet: FromClientUpdatePacket) {
        const player = this.clients[username].player
        if (packet.paused) {
            player.dummy.input.clearPressed()
            player.dummy.nextGatherInput = emptyGatherInput()
        }
        /* dont allow the client to send an arbitrary position */
        packet.pos = undefined
        player.dummy.setState(packet)
    }

    // getPlayers(): Player[] {
    //     const players: Player[] = []
    //     for (const map of this.getActiveMaps()) {
    //         players.push(...map.players)
    //     }
    //     return players
    // }
    //
    // getPlayerByEntity(e: ig.dummy.DummyPlayer): Player {
    //     return this.getPlayers().find(p => p.dummy === e)!
    // }
    //
    // leavePlayer(player: Player) {
    //     player.disconnect()
    //     /* save data todo */
    // }

    // async playerUpdate(player: Player, packet: FromClientUpdatePacket) {
    //     const map = this.maps[player.mapName]
    //     if (!map) return
    //     map.scheduledPacketsForUpdate.push({ player, packet })
    // }

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
}
