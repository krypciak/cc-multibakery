import { startGameLoop } from '../game-loop'
import { CCMap } from './ccmap/ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, ClientSettings } from '../client/client'
import { assert } from '../misc/assert'
import { isErrorPopupShown, showServerErrorPopup } from '../misc/error-popup'
import { applyUpdateable, InstanceUpdateable } from './instance-updateable'
import { removeAddon } from '../dummy/box/box-addon'
import { invalidateOldPlayerLocations, updatePlayerLocations } from '../map-gui/player-locations'

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

export abstract class Server<S extends ServerSettings = ServerSettings> extends InstanceUpdateable {
    protected abstract remote: boolean

    baseInst!: InstanceinatorInstance

    maps: Map<string, CCMap> = new Map()
    clients: Map<string, Client> = new Map()

    private masterUsername?: string

    measureTraffic: boolean = false
    destroyed: boolean = false // or destroying
    destroyOnLastClientLeave: boolean = false
    postUpdateCallback?: () => void

    constructor(public settings: S) {
        super()
    }

    isActive() {
        return true
    }

    isVisible() {
        return !!this.settings.displayServerInstance
    }

    protected attemptRecovery(e: unknown) {
        throw e
    }

    private safeguardInst() {
        Object.defineProperty(this.inst.ig.game.entities, 'push', {
            get() {
                console.warn('push on server entities!', instanceinator.id)
                debugger
                return () => {}
            },
        })
    }

    async start(useAnimationFrame = false) {
        assert(!isErrorPopupShown())

        instanceinator.displayId = true
        instanceinator.displayFps = true

        this.baseInst = instanceinator.instances[0]
        this.inst = await instanceinator.copy(multi.server.baseInst, 'server', this.isVisible())
        this.inst.apply()
        this.safeguardInst()

        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        this.inst.ig.gamepad = new multi.class.SingleGamepadManager()

        startGameLoop(useAnimationFrame)

        multi.class.gamepadAssigner.initialize()
    }

    update() {
        super.update()

        updatePlayerLocations()
        invalidateOldPlayerLocations()
    }

    private preUpdateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.inst, true)) updateable.preUpdate()
        }
    }

    private updateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.inst)) updateable.update()
        }
    }

    private deferredUpdateFor(updateables: InstanceUpdateable[] | MapIterator<InstanceUpdateable>) {
        for (const updateable of updateables) {
            if (applyUpdateable(updateable, this.inst)) updateable.deferredUpdate()
        }
    }

    runUpdate() {
        multi.class.gamepadAssigner.update()

        this.preUpdateFor([this])
        this.preUpdateFor(this.maps.values())
        this.preUpdateFor(this.clients.values())

        this.updateFor([this])
        this.updateFor(this.maps.values())
        this.updateFor(this.clients.values())

        this.inst.apply()
    }

    runDeferredUpdate() {
        this.deferredUpdateFor([this])
        this.deferredUpdateFor(this.maps.values())
        this.deferredUpdateFor(this.clients.values())

        this.inst.apply()
        this.postUpdateCallback?.()
    }

    onInstanceUpdateError(error: unknown): never {
        const inst = instanceinator.instances[instanceinator.id]
        showServerErrorPopup(inst, error)
        multi.destroyAndStartLoop()
        throw error
    }

    getActiveAndReadyMaps() {
        return [...this.maps.values()].filter(map => map.ready && map.isActive())
    }

    async loadMap(name: string) {
        this.maps.get(name)?.destroy()
        const map = new CCMap(name, this.remote)
        this.maps.set(name, map)
        await map.init()
    }

    unloadMap(map: CCMap) {
        assert(map)
        this.maps.delete(map.name)
        map.destroy()
    }

    protected async joinClient(client: Client) {
        assert(!this.clients.has(client.username))
        this.clients.set(client.username, client)
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
        assert(this.inst.id != id && this.baseInst.id != id)
        this.clients.delete(client.username)
        client.destroy()

        if (this.destroyOnLastClientLeave) {
            if (this.clients.size == 0) {
                if (!this.destroyed) {
                    multi.destroyNextFrameAndStartLoop()
                }
            } else {
                this.setMasterClient(this.clients.values().next()?.value!)
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

        this.inst.apply()

        for (const client of this.clients.values()) {
            this.leaveClient(client)
        }

        ig.system.stopRunLoop()

        for (const map of this.maps.values()) {
            map.destroy()
        }
        this.baseInst.apply()
        super.destroy()

        multi.class.gamepadAssigner.clearAllState()

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
