import { DeterMineInstance } from 'cc-determine/src/instance'
import { copyTickInfo, startGameLoop } from '../game-loop'
import { CCMap } from './ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, ClientSettings } from '../client/client'
import { removeAddon } from '../dummy/dummy-box-addon'
import { assert } from '../misc/assert'

export interface ServerSettings {
    globalTps: number
    forceConsistentTickTimes?: boolean
    displayServerInstance?: boolean
    displayMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayClientInstances?: boolean

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export abstract class Server<S extends ServerSettings = ServerSettings> {
    abstract settings: S

    maps: Record<string, CCMap> = {}
    mapsById: Record<number, CCMap> = {}
    clientsById: Record<number, Client> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance
    serverDeterminism!: DeterMineInstance

    unreadyClients: Record<string, Client> = {}
    clients: Record<string, Client> = {}

    async start() {
        this.baseInst = instanceinator.instances[0]
        this.serverInst = await instanceinator.copy(this.baseInst, 'server', this.settings.displayServerInstance)
        this.serverInst.apply()
        this.safeguardServerInstance()

        this.serverDeterminism = new determine.Instance('welcome to hell')
        determine.append(this.serverDeterminism)
        determine.apply(this.serverDeterminism)

        removeAddon(this.serverInst.ig.gamepad, this.serverInst.ig.game)
        this.serverInst.ig.gamepad = new multi.class.SingleGamepadManager()

        startGameLoop()

        multi.class.gamepadAssigner.initialize()
    }

    update() {
        multi.class.gamepadAssigner.update()

        ig.game.update()

        const run = (obj: { inst: InstanceinatorInstance; determinism: DeterMineInstance; update?(): void }) => {
            if (!obj.inst) return
            copyTickInfo(this.serverInst, obj.inst)
            obj.inst.apply()
            determine.apply(obj.determinism)
            if (obj.update) obj.update()
            ig.game.update()
        }

        for (const name in this.maps) {
            const map = this.maps[name]
            run(map)
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            run(client)
        }

        this.serverInst.apply()
        determine.apply(this.serverDeterminism)
    }

    deferredUpdate() {
        ig.game.deferredUpdate()

        const run = (obj: { inst: InstanceinatorInstance; determinism: DeterMineInstance; update?(): void }) => {
            if (!obj.inst) return
            copyTickInfo(this.serverInst, obj.inst)
            obj.inst.apply()
            determine.apply(obj.determinism)
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        }

        for (const name in this.maps) {
            const map = this.maps[name]
            run(map)
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            run(client)
        }

        this.serverInst.apply()
        determine.apply(this.serverDeterminism)
        ig.input.clearPressed()
    }

    async loadMap(name: string) {
        if (this.maps[name]) this.maps[name].destroy()
        const map = new CCMap(name)
        this.maps[name] = map
        await map.load()
        this.mapsById[map.inst.id] = map
    }

    async joinClient(client: Client) {
        assert(!this.clients[client.player.username])
        this.clients[client.player.username] = client
        this.clientsById[client.inst.id] = client
        await client.player.teleport(client.player.mapName, client.player.marker)
    }

    async createAndJoinClient(settings: ClientSettings) {
        const client = new Client(settings)

        this.unreadyClients[settings.username] = client

        await client.init()
        await this.joinClient(client)
        await client.teleport()

        delete this.unreadyClients[settings.username]

        return client
    }

    async leaveClient(client: Client) {
        const id = client.inst.id
        assert(this.serverInst.id != id && this.baseInst.id != id && !this.mapsById[id])
        delete this.clientsById[id]
        delete this.clients[client.player.username]
        await client.destroy()
    }

    private safeguardServerInstance() {
        Object.defineProperty(this.serverInst.ig.game.entities, 'push', {
            get() {
                console.warn('push on server entities!', instanceinator.id)
                debugger
                return () => {}
            },
        })
    }

    async destroy() {
        assert(instanceinator.id == this.serverInst.id)
        ig.system.stopRunLoop()

        for (const client of Object.values(this.clientsById)) {
            await this.leaveClient(client)
        }
        for (const map of Object.values(this.maps)) {
            await map.destroy()
        }
        determine.apply(determine.instances[0])
        this.baseInst.apply()

        instanceinator.delete(this.serverInst)
        determine.delete(this.serverDeterminism)

        this.baseInst.display = true
        instanceinator.displayId = modmanager.options['cc-instanceinator'].displayId
        instanceinator.displayFps = modmanager.options['cc-instanceinator'].displayFps
    }
}

export function waitForScheduledTask(inst: InstanceinatorInstance, task: () => Promise<void> | void) {
    return new Promise<void>(resolve => {
        inst.ig.game.scheduledTasks.push(async () => {
            await task()
            resolve()
        })
    })
}
