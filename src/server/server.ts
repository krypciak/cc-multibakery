import { startGameLoop } from '../game-loop'
import { CCMap } from './ccmap/ccmap'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { Client, type ClientSettings } from '../client/client'
import { assert } from '../misc/assert'
import { isErrorPopupShown, showServerErrorPopup } from '../misc/error-popup'
import { applyUpdateable, InstanceUpdateable } from './instance-updateable'
import { removeAddon } from '../misc/game-addon-util'
import { linkOptions } from './physics/storage/storage'
import { MultiPartyManager } from '../party/party'
import type { MapName, Username } from '../net/binary/binary-types'
import type { PlayerInfoEntry } from '../state/player-info'
import type { InstanceinatorCopyInstanceConfig } from 'cc-instanceinator/src/instance-copy'
import { removeUnnecessarySystemsForServerInstance } from './game-systems-cleanup'
import type { EntityNetid } from '../misc/entity-netid'
import type { NetConnection } from '../net/net-connection'
import { isUsernameValid } from '../misc/username-util'
import { executeWithStrategy } from '../misc/function-execute-strategy'
import { isRemote } from './remote/is-remote-server'
import { ValueAverageOverTime } from 'cc-instanceinator/src/label-draw'

import './server-var-access'

export interface MapTpInfo {
    map: MapName
    marker?: Nullable<string>
}

export interface ServerSettings {
    tps: number
    forceConsistentTickTimes?: boolean
    intervalFps?: number

    displayServerInstance?: boolean
    displayMaps?: boolean
    forceMapsActive?: boolean
    displayInactiveMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayClientInstances?: boolean
    displayRemoteClientInstances?: boolean
    defaultMap?: MapTpInfo
    attemptCrashRecovery?: boolean
    mapSwitchDelay?: number
}

export interface ClientJoinData {
    username: Username
    initialInputType?: ig.INPUT_DEVICES
    prefferedTpInfo?: MapTpInfo
}
export function isClientJoinData(_data: unknown): _data is ClientJoinData {
    const data = _data as ClientJoinData
    if (!data || typeof data !== 'object') return false
    if (!data.username || typeof data.username !== 'string') return false
    if (data.initialInputType !== undefined) {
        if (typeof data.initialInputType !== 'number') return false
        if (!Object.values(ig.INPUT_DEVICES).includes(data.initialInputType)) return false
    }
    return true
}
export type ClientJoinAckData =
    | {
          status: 'username_taken' | 'invalid_join_data' | 'invalid_username'
      }
    | {
          status: 'ok'
          tpInfo?: MapTpInfo
          reservedNetid?: EntityNetid
      }

export interface ClientCreateAndJoinSettings {
    connection?: NetConnection
    awaitClientJoin?: boolean
    clientSettingsOverride?: Partial<ClientSettings>
    ackDataOverride?: ClientJoinAckData
}

export abstract class Server<S extends ServerSettings = ServerSettings> extends InstanceUpdateable {
    abstract physics: boolean
    updateDelayAvg: ValueAverageOverTime
    lastUpdateTime: number = 0

    baseInst!: InstanceinatorInstance

    maps: Map<MapName, CCMap> = new Map()
    clients: Map<Username, Client> = new Map()

    private masterUsername?: Username

    party: MultiPartyManager = new MultiPartyManager()

    measureTraffic: boolean = false
    destroyed: boolean = false // or destroying
    destroyOnLastClientLeave: boolean = false
    postUpdateCallback?: () => void

    constructor(public settings: S) {
        super()

        this.baseInst = instanceinator.instances[0]
        this.updateDelayAvg = new ValueAverageOverTime(settings.tps)
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

    private link() {
        linkOptions(this.inst, this.baseInst)
    }

    private createCachedInstances() {
        PROFILE && console.time('creating instances non await')
        const toCreate = 3 - instanceinator.getCachedInstanceCount(instanceinatorCopyInstanceConfig().cacheKey)
        if (toCreate > 0) {
            instanceinator.createCachedInstances(
                this.baseInst,
                new Array(toCreate).fill(null).map(_ => instanceinatorCopyInstanceConfig())
            )
        }
        PROFILE && console.timeEnd('creating instances non await')
    }

    async start(useAnimationFrame = false) {
        assert(!isErrorPopupShown())

        this.createCachedInstances()

        this.inst = await instanceinator.copy(
            this.baseInst,
            { name: 'server', display: this.isVisible() },
            instanceinatorCopyInstanceConfig()
        )
        this.inst.apply()
        removeUnnecessarySystemsForServerInstance()
        this.safeguardInst()
        this.link()
        this.updateMusicInstance()

        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        this.inst.ig.gamepad = new multi.class.SingleGamepadManager()

        startGameLoop(useAnimationFrame)

        multi.class.gamepadAssigner.initialize()
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

    private updateUpdateDelayAvg() {
        const time = performance.now()
        if (this.lastUpdateTime != 0) {
            const timeDiff = time - this.lastUpdateTime
            this.updateDelayAvg.pushValue(timeDiff)
        }
        this.lastUpdateTime = time
    }

    runUpdate() {
        this.updateUpdateDelayAvg()
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

    getMap(name: MapName): CCMap {
        let map: CCMap | undefined = this.maps.get(name)
        if (map) return map
        map = new CCMap(name)
        this.maps.set(name, map)
        return map
    }

    unloadMap(map: CCMap) {
        assert(map)
        this.maps.delete(map.name)
        map.destroy()
    }

    protected joinClient(client: Client) {
        assert(!this.clients.has(client.username))
        this.clients.set(client.username, client)
    }

    protected validatePrefferedMap(
        tpInfo: MapTpInfo | undefined,
        connection: NetConnection | undefined
    ): MapTpInfo | undefined {
        const map = tpInfo?.map
        if (!map) return
        if (isRemote(this) && !this.maps.has(map)) return

        if (
            connection &&
            !connection.clients.some(client => client.tpInfo.map == tpInfo.map && client.tpInfo.marker == tpInfo.marker)
        ) {
            return
        }

        return tpInfo
    }

    protected createAndJoinClientInitialChecks(joinData: ClientJoinData) {
        assert(instanceinator.id == this.inst.id)
        assert(isClientJoinData(joinData))
        const username = joinData.username
        if (!isUsernameValid(username)) return { ackData: { status: 'invalid_username' } }
        if (this.clients.has(username)) return { ackData: { status: 'username_taken' } }
    }

    private async initAndJoinClient(client: Client, tpInfo: MapTpInfo) {
        await client.init()
        this.joinClient(client)
        await client.teleport(tpInfo, true)
    }

    protected async initAndJoinClientStrategy(
        client: Client,
        tpInfo: MapTpInfo,
        connection: NetConnection | undefined,
        awaitClientJoin: boolean | undefined
    ) {
        return executeWithStrategy(
            () => this.initAndJoinClient(client, tpInfo),
            connection
                ? { type: 'delayNoAwait', delay: 40, then: () => connection.join(client) }
                : awaitClientJoin
                  ? { type: 'await' }
                  : { type: 'noAwait' }
        )
    }

    abstract createAndJoinClient(
        joinData: ClientJoinData,
        settings?: ClientCreateAndJoinSettings
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }>

    leaveClient(client: Client) {
        /* TODO: communicate socket that closed?? */
        const id = client.inst.id
        assert(this.inst.id != id && this.baseInst.id != id)
        client.destroy()
        this.clients.delete(client.username)

        if (this.destroyOnLastClientLeave) {
            if (this.clients.size == 0) {
                if (!this.destroyed) {
                    multi.destroyNextFrameAndStartLoop()
                }
            } else {
                this.setMasterClient(this.clients.values().next()?.value!)
            }
        }
        this.updateMusicInstance()
    }

    setMasterClient(client: Client): Client {
        assert(client.ready)
        this.masterUsername = client.username
        this.updateMusicInstance()
        multi.storage.save()
        return client
    }

    getMasterClient(): Client | undefined {
        if (!this.masterUsername) return
        return this.clients.get(this.masterUsername)
    }

    private updateMusicInstance() {
        const masterClient = this.getMasterClient()
        instanceinator.musicInstanceId = masterClient?.inst.id ?? this.inst.id
    }

    abstract getPlayerInfoOf(username: Username): PlayerInfoEntry

    abstract getPlayerInfoEntries(): Record<Username, PlayerInfoEntry>

    getAllInstances(): InstanceinatorInstance[] {
        return [this.inst, ...[...this.maps.values(), ...this.clients.values()].map(obj => obj.inst)].filter(Boolean)
    }

    destroy() {
        if (this.destroyed) return
        this.postUpdateCallback = undefined

        this.inst?.apply()

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
        instanceinator.musicInstanceId = this.baseInst.id

        instanceinator.retile()
    }
}

export function instanceinatorCopyInstanceConfig(): InstanceinatorCopyInstanceConfig {
    return { cacheKey: 'multibakery', hideTitleScreen: true }
}

export function showTryNetJoinResponseDialog(joinData: ClientJoinData, resp: ClientJoinAckData) {
    if (resp.status == 'ok') return
    let msg!: string
    assert(resp.status != 'invalid_join_data', 'invalid_join_data??')
    if (resp.status == 'username_taken') msg = `Error: username "${joinData.username}" is taken.`
    else if (resp.status == 'invalid_username') msg = `Error: username "${joinData.username} is invalid.`
    assert(msg)
    sc.Dialogs.showErrorDialog(msg)
}
