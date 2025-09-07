import { startGameLoop } from '../game-loop'
import { CCMap } from './ccmap/ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, ClientSettings } from '../client/client'
import { assert } from '../misc/assert'
import { isErrorPopupShown, showServerErrorPopup } from '../misc/error-popup'
import { applyUpdateable, InstanceUpdateable } from './instance-updateable'
import { ServerInstance } from './server-instance'

export interface ServerSettings {
    tps: number
    forceConsistentTickTimes?: boolean

    displayServerInstance?: boolean
    displayMaps?: boolean
    forceMapsActive?: boolean
    displayInactiveMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayClientInstances?: boolean
    displayRemoteClientInstances?: boolean
    defalutMap?: {
        map: string
        marker?: string
    }
    attemptCrashRecovery?: boolean
}

export interface ClientJoinData {
    username: string
    initialInputType: ig.INPUT_DEVICES
}
export function createClientJoinData(options: ClientJoinData): ClientJoinData {
    return options
}
export function isClientJoinData(_data: unknown): _data is ClientJoinData {
    const data = _data as ClientJoinData
    return (
        !!data &&
        typeof data == 'object' &&
        !!data.username &&
        typeof data.username == 'string' &&
        typeof data.initialInputType == 'number' &&
        Object.values(ig.INPUT_DEVICES).includes(data.initialInputType)
    )
}
export interface ClientJoinAckData {
    status: 'ok' | 'username_taken' | 'invalid_join_data' | 'invalid_username'
    mapName?: string
}

export abstract class Server<S extends ServerSettings = ServerSettings> {
    protected abstract remote: boolean

    baseInst!: InstanceinatorInstance
    serverInst: ServerInstance

    maps: Map<string, CCMap> = new Map()
    mapsById: Map<number, CCMap> = new Map()

    clients: Map<string, Client> = new Map()
    clientsById: Map<number, Client> = new Map()

    private masterUsername?: string

    measureTraffic: boolean = false
    destroyed: boolean = false // or destroying
    destroyOnLastClientLeave: boolean = false
    postUpdateCallback?: () => void

    protected constructor(public settings: S) {
        this.serverInst = new ServerInstance()
    }

    async start(useAnimationFrame = false) {
        assert(!isErrorPopupShown())

        instanceinator.displayId = true
        instanceinator.displayFps = true

        this.baseInst = instanceinator.instances[0]
        await this.serverInst.init()

        startGameLoop(useAnimationFrame)

        multi.class.gamepadAssigner.initialize()
    }

    private preUpdateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.serverInst.inst, true)) updateable.preUpdate()
        }
    }

    private updateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.serverInst.inst)) updateable.update()
        }
    }

    update() {
        multi.class.gamepadAssigner.update()

        this.preUpdateFor([this.serverInst])
        this.preUpdateFor(this.maps.values())
        this.preUpdateFor(Object.values(this.clients))

        this.updateFor([this.serverInst])
        this.updateFor(this.maps.values())
        this.updateFor(Object.values(this.clients))

        this.serverInst.inst.apply()
    }

    private deferredUpdateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.serverInst.inst)) updateable.deferredUpdate()
        }
    }

    deferredUpdate() {
        this.deferredUpdateFor([this.serverInst])
        this.deferredUpdateFor(this.maps.values())
        this.deferredUpdateFor(Object.values(this.clients))

        this.serverInst.inst.apply()
        this.postUpdateCallback?.()
    }

    onInstanceUpdateError(error: unknown): never {
        const inst = instanceinator.instances[instanceinator.id]
        showServerErrorPopup(inst, error)
        multi.destroyAndStartLoop()
        throw error
    }

    getActiveAndReadyMaps() {
        return Object.values(this.maps).filter(map => map.ready && map.isActive())
    }

    async loadMap(name: string) {
        this.maps.get(name)?.destroy()
        const map = new CCMap(name, this.remote)
        this.maps.set(name, map)
        await map.init()
        this.mapsById.set(map.inst.id, map)
    }

    async unloadMap(map: CCMap) {
        assert(map)
        this.maps.delete(map.name)
        this.mapsById.delete(map.inst.id)
        map.destroy()
    }

    protected async joinClient(client: Client) {
        assert(!this.clients.has(client.username))
        this.clients.set(client.username, client)
        this.clientsById.set(client.inst.id, client)
    }

    async createAndJoinClient(settings: ClientSettings) {
        const client = await Client.create(settings)
        await this.joinClient(client)
        await client.teleportInitial(settings.mapName)

        return client
    }

    abstract tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }>

    leaveClient(client: Client) {
        /* TODO: communicate socket that closed?? */
        const id = client.inst.id
        assert(this.serverInst.inst.id != id && this.baseInst.id != id && !this.mapsById.has(id))
        this.clientsById.delete(id)
        this.clients.delete(client.username)
        client.destroy()

        if (this.destroyOnLastClientLeave) {
            if (Object.keys(this.clients).length == 0) {
                if (!this.destroyed) {
                    multi.destroyNextFrameAndStartLoop()
                }
            } else {
                this.setMasterClient(Object.values(this.clients)[0])
            }
        }
    }

    setMasterClient(client: Client): Client {
        this.masterUsername = client.username
        multi.storage.save()
        return client
    }

    getMasterClient(): Client | undefined {
        if (!this.masterUsername) return
        return this.clients.get(this.masterUsername)
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true
        this.postUpdateCallback = undefined

        this.serverInst.inst.apply()

        for (const client of Object.values(this.clientsById)) {
            this.leaveClient(client)
        }

        ig.system.stopRunLoop()

        for (const map of Object.values(this.maps)) {
            map.destroy()
        }
        this.baseInst.apply()

        this.serverInst.destroy()

        this.baseInst.display = true
        instanceinator.displayId = modmanager.options['cc-instanceinator'].displayId
        instanceinator.displayFps = modmanager.options['cc-instanceinator'].displayFps

        instanceinator.retile()
    }
}

export function showTryNetJoinResponseDialog(joinData: ClientJoinData, resp: ClientJoinAckData) {
    if (resp.status == 'ok') return
    let msg!: string
    assert(resp.status != 'invalid_join_data', 'invalid_join_data??')
    if (resp.status == 'username_taken') msg = `Error: username "${joinData.username}" is taken.`
    assert(msg)
    sc.Dialogs.showErrorDialog(msg)
}
