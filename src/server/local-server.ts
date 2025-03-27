import { DeterMineInstance } from 'cc-determine/src/instance'
import { copyTickInfo, startGameLoop } from '../game-loop'
import { prestart } from '../plugin'
import { CCMap } from './ccmap'
import { Server, ServerSettings } from './server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, ClientSettings } from '../client/client'
import { removeAddon } from '../dummy/dummy-box-addon'
import { assert } from '../misc/assert'

export interface LocalServerSettings extends ServerSettings {
    slotName?: string
    // host?: string
    // port?: number
    displayServerInstance?: boolean
    displayMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayLocalClientMaps?: boolean

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export type ServerPlayerClient = Client

export class LocalServer implements Server<LocalServerSettings> {
    maps: Record<string, CCMap> = {}
    mapsById: Record<number, CCMap> = {}
    localSharedClientById: Record<number, Client> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance
    serverDeterminism!: DeterMineInstance

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

    async start() {
        instanceinator.displayId = true
        instanceinator.instances[0].display = false

        this.baseInst = instanceinator.instances[0]
        this.serverInst = await instanceinator.copy(this.baseInst, 'server', this.s.displayServerInstance)
        this.serverInst.apply()
        this.safeguardServerInstance()

        this.serverDeterminism = new determine.Instance('welcome to hell')
        determine.append(this.serverDeterminism)
        determine.apply(this.serverDeterminism)

        removeAddon(this.serverInst.ig.gamepad, this.serverInst.ig.game)
        this.serverInst.ig.gamepad = new multi.class.SingleGamepadManager()

        startGameLoop()

        multi.class.gamepadAssigner.initialize()

        if (window.crossnode?.options.test) return

        await this.createAndJoinLocalSharedClient({
            username: `lea_1`,
        })
        // await this.createAndJoinLocalSharedClient({
        //     username: `luke_1`,
        // })
        // await this.createAndJoinLocalSharedClient({
        //     username: `luke_2`,
        // })
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

    async joinClient(client: ServerPlayerClient) {
        this.clients[client.player.username] = client
        await client.player.teleport(client.player.mapName, client.player.marker)
    }

    async createAndJoinLocalSharedClient(settings: Omit<ClientSettings, 'baseInst'>) {
        const s = Object.assign(settings, {
            baseInst: this.baseInst,
        })
        const client = new Client(s)
        await client.init()
        this.localSharedClientById[client.inst.id] = client
        await this.joinClient(client)
        await client.teleport()
    }

    leaveClient(id: number): void {
        assert(this.serverInst.id != id && this.baseInst.id != id && !this.mapsById[id])
        const client = this.localSharedClientById[id]
        assert(client)
        client.destroy()
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
        this.baseInst.apply()

        determine.apply(determine.instances[0])
        for (const client of Object.values(this.localSharedClientById)) {
            await client.destroy()
        }
        for (const map of Object.values(this.maps)) {
            await map.destroy()
        }
        instanceinator.delete(this.serverInst)

        determine.delete(this.serverDeterminism)
        determine.apply(determine.instances[0])
    }
}

prestart(() => {
    ig.Game.inject({
        draw() {
            if (!(multi.server instanceof LocalServer) || instanceinator.id != multi.server.serverInst.id)
                return this.parent()

            this.renderer.prepareDraw([])
            for (const addon of this.addons.postDraw) addon.onPostDraw()

            multi.server.serverInst.drawLabel()
        },
    })
})

export function waitForScheduledTask(inst: InstanceinatorInstance, task: () => Promise<void> | void) {
    return new Promise<void>(resolve => {
        inst.ig.game.scheduledTasks.push(async () => {
            await task()
            resolve()
        })
    })
}
