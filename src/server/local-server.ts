import { DeterMineInstance } from 'cc-determine/src/instance'
import { Client } from '../client/client'
import { copyTickInfo, startGameLoop } from '../game-loop'
import { prestart } from '../plugin'
import { CCMap } from './ccmap'
import { Server, ServerSettings } from './server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { LocalServerConsoleDialog } from './local-server-console'
import { LocalSharedClient, LocalSharedClientSettings } from '../client/local-shared-client'
import { LocalDummyClient } from '../client/local-dummy-client'
import { removeAddon } from '../dummy/dummy-box-addon'

export interface LocalServerSettings extends ServerSettings {
    slotName?: string
    host?: string
    port?: number
    displayServerInstance?: boolean
    displayMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayLocalClientMaps?: boolean

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export type ServerPlayerClient = LocalDummyClient

export class LocalServer implements Server<LocalServerSettings> {
    maps: Record<string, CCMap> = {}
    mapsById: Record<number, CCMap> = {}
    localSharedClientById: Record<number, LocalSharedClient> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance
    serverDeterminism!: DeterMineInstance

    consoleDialog!: LocalServerConsoleDialog

    clients: Record<string, Client> = {}

    constructor(public s: LocalServerSettings) {}

    async start() {
        instanceinator.displayId = true
        instanceinator.instances[0].display = false

        this.baseInst = instanceinator.instances[0]
        this.serverInst = await instanceinator.copy(this.baseInst, 'server', this.s.displayServerInstance)
        this.serverInst.apply()
        this.serverDeterminism = new determine.Instance('welcome to hell')
        determine.append(this.serverDeterminism)
        determine.apply(this.serverDeterminism)

        removeAddon(this.serverInst.ig.gamepad, this.serverInst.ig.game)
        this.serverInst.ig.gamepad = new dummy.input.Clone.SingleGamepadManager()

        startGameLoop()

        this.consoleDialog = new LocalServerConsoleDialog()
        this.consoleDialog.openServerConsole()

        dummy.input.Clone.gamepadAssigner.initialize()

        if (window.crossnode?.options.test) return

        await this.createAndJoinLocalSharedClient({
            username: `lea_1`,
        })
        await this.createAndJoinLocalSharedClient({
            username: `luke_1`,
            forceInputType: ig.INPUT_DEVICES.GAMEPAD,
        })
        // await this.createAndJoinLocalSharedClient({
        //     username: `luke_2`,
        //     forceInputType: ig.INPUT_DEVICES.GAMEPAD,
        // })
    }

    update() {
        dummy.input.Clone.gamepadAssigner.onPreUpdate()

        ig.game.update()

        const run = ({ inst, determinism }: { inst: InstanceinatorInstance; determinism: DeterMineInstance }) => {
            if (!inst) return
            copyTickInfo(this.serverInst, inst)
            inst.apply()
            determine.apply(determinism)
            ig.game.update()
        }

        for (const name in this.maps) {
            const map = this.maps[name]
            run(map)
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            if (client instanceof LocalSharedClient) run(client)
        }

        this.serverInst.apply()
        determine.apply(this.serverDeterminism)
    }

    deferredUpdate() {
        ig.game.deferredUpdate()

        const run = ({ inst, determinism }: { inst: InstanceinatorInstance; determinism: DeterMineInstance }) => {
            if (!inst) return
            copyTickInfo(this.serverInst, inst)
            inst.apply()
            determine.apply(determinism)
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        }

        for (const name in this.maps) {
            const map = this.maps[name]
            run(map)
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            if (client instanceof LocalSharedClient) run(client)
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

    async createAndJoinLocalSharedClient(settings: Omit<LocalSharedClientSettings, 'baseInst'>) {
        const s = Object.assign(settings, {
            baseInst: this.baseInst,
        })
        const client = new LocalSharedClient(s)
        await client.init()
        this.localSharedClientById[client.inst.id] = client
        await this.joinClient(client)
        await client.teleport()
    }

    destroy() {
        this.baseInst.apply()

        determine.apply(determine.instances[0])
        this.consoleDialog.destroy()
        for (const map of Object.values(this.maps)) {
            map.destroy()
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
