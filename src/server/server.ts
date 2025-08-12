import { copyTickInfo, startGameLoop } from '../game-loop'
import { CCMap } from './ccmap/ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, ClientSettings } from '../client/client'
import { removeAddon } from '../dummy/dummy-box-addon'
import { assert } from '../misc/assert'
import { showServerErrorPopup } from '../misc/error-popup'

import './event/event'

export interface ServerSettings {
    globalTps: number
    forceConsistentTickTimes?: boolean
    displayServerInstance?: boolean
    displayMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayClientInstances?: boolean
    displayRemoteClientInstances?: boolean

    // unloadInactiveMapsMs?: number /* set to -1 to disable unloading inactive maps */
}

export interface ClientJoinData {
    username: string
    initialInputType: ig.INPUT_DEVICES
    stepCount: number
}
export function createClientJoinData(options: Omit<ClientJoinData, 'stepCount'>): ClientJoinData {
    return Object.assign(options, {
        stepCount: multi.stepCount
    })
}
export function isClientJoinData(data: unknown): data is ClientJoinData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}
export type ClientJoinAckData = {
    status: 'ok' | 'username_taken' | 'invalid_join_data' | 'invalid_username' | 'step_count_low' | 'step_count_high'
}

export interface GameLoopUpdateable {
    inst: InstanceinatorInstance

    update(): void
    deferredUpdate(): void
}

export abstract class Server<S extends ServerSettings = ServerSettings> {
    abstract settings: S
    protected abstract remote: boolean

    maps: Record<string, CCMap> = {}
    mapsById: Record<number, CCMap> = {}
    clientsById: Record<number, Client> = {}

    baseInst!: InstanceinatorInstance
    serverInst!: InstanceinatorInstance

    clients: Record<string, Client> = {}
    masterUsername?: string

    measureTraffic: boolean = false
    attemptCrashRecovery: boolean = false
    destroyed: boolean = false // or destroying

    async start() {
        instanceinator.displayId = false
        instanceinator.displayFps = false

        this.baseInst = instanceinator.instances[0]
        this.serverInst = await instanceinator.copy(this.baseInst, 'server', this.settings.displayServerInstance)
        this.serverInst.apply()
        this.safeguardServerInstance()

        removeAddon(this.serverInst.ig.gamepad, this.serverInst.ig.game)
        this.serverInst.ig.gamepad = new multi.class.SingleGamepadManager()

        startGameLoop()

        multi.class.gamepadAssigner.initialize()
    }

    private applyUpdateable(obj: GameLoopUpdateable): boolean {
        if (!obj.inst) return false

        copyTickInfo(this.serverInst, obj.inst)
        obj.inst.apply()

        return true
    }

    update() {
        multi.class.gamepadAssigner.update()

        ig.game.update()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (this.applyUpdateable(map)) map.update()
            if (!multi.server) return
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            if (this.applyUpdateable(client)) client.update()
            if (!multi.server) return
        }
        this.serverInst.apply()
    }

    deferredUpdate() {
        ig.game.deferredUpdate()

        for (const name in this.maps) {
            const map = this.maps[name]
            if (this.applyUpdateable(map)) map.deferredUpdate()
            if (!multi.server) return
        }
        for (const clientId in this.clients) {
            const client = this.clients[clientId]
            if (this.applyUpdateable(client)) client.deferredUpdate()
            if (!multi.server) return
        }

        this.serverInst.apply()
        ig.input.clearPressed()
    }

    onInstanceUpdateError(error: unknown): never {
        const inst = instanceinator.instances[instanceinator.id]
        showServerErrorPopup(inst, error)
        multi.destroyAndStartLoop()
        throw error
    }

    async loadMap(name: string) {
        this.maps[name]?.destroy()
        const map = new CCMap(name, this.remote)
        this.maps[name] = map
        await map.load()
        this.mapsById[map.inst.id] = map
    }

    async unloadMap(map: CCMap) {
        assert(map)
        delete this.maps[map.name]
        delete this.mapsById[map.inst.id]
        map.destroy()
    }

    private async joinClient(client: Client) {
        assert(!this.clients[client.player.username])
        this.clients[client.player.username] = client
        this.clientsById[client.inst.id] = client
    }

    async createAndJoinClient(settings: ClientSettings) {
        const client = new Client(settings)

        await client.init()
        await this.joinClient(client)
        const mapName = settings.mapName ?? 'multibakery/dev' // 'rhombus-dng/room-1'
        const marker = 'puzzle' // 'pvp' //'entrance'
        await client.teleport(mapName, marker)

        return client
    }

    abstract tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }>

    leaveClient(client: Client) {
        /* TODO: communicate socket that closed?? */
        const id = client.inst.id
        assert(this.serverInst.id != id && this.baseInst.id != id && !this.mapsById[id])
        delete this.clientsById[id]
        delete this.clients[client.player.username]
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

    destroy() {
        if (this.destroyed) return
        this.destroyed = true

        this.serverInst.apply()

        for (const client of Object.values(this.clientsById)) {
            this.leaveClient(client)
        }

        ig.system.stopRunLoop()

        for (const map of Object.values(this.maps)) {
            map.destroy()
        }
        this.baseInst.apply()

        instanceinator.delete(this.serverInst)

        this.baseInst.display = true
        instanceinator.displayId = modmanager.options['cc-instanceinator'].displayId
        instanceinator.displayFps = modmanager.options['cc-instanceinator'].displayFps
    }
}

export function showTryNetJoinResponseDialog(joinData: ClientJoinData, resp: ClientJoinAckData) {
    if (resp.status == 'ok') return
    let msg!: string
    assert(resp.status != 'invalid_join_data', 'invalid_join_data??')
    if (resp.status == 'username_taken') msg = `Error: username "${joinData.username}" is taken.`
    if (resp.status == 'step_count_low') msg = `Error: Step count too low! Are you missing any mods?`
    if (resp.status == 'step_count_high') msg = `Error: Step count too high! Do you have incompatible mods installed?`
    assert(msg)
    sc.Dialogs.showErrorDialog(msg)
}
