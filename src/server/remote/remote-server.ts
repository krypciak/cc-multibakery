import type { NetConnection } from '../../net/net-connection'
import type { PhysicsServerUpdatePacket } from '../physics/physics-server-sender'
import type { CCMap } from '../ccmap/ccmap'
import type { MapName, Username } from '../../net/binary/binary-types'
import type { PlayerInfoEntry } from '../../state/player-info'
import type { NetServerInfoRemote } from '../../client/menu/server-info'
import type { StrictNonNullable } from '../../types'
import { NetManagerRemoteServer } from '../../net/net-manager-remote'
import { applyGlobalStateUpdatePacket, applyStateUpdatePacket } from '../../state/states'
import { assert } from '../../misc/assert'
import {
    type ClientCreateAndJoinSettings,
    type ClientJoinAckData,
    type ClientJoinData,
    Server,
    type ServerSettings,
} from '../server'
import { Client, type ClientSettings } from '../../client/client'
import { Opts } from '../../options'
import { TemporarySet } from '../../misc/temporary-set'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { sendRemoteServerPacket } from './remote-server-sender'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'
import { applyModCompatibilityList, type ModCompatibilityList } from '../mod-compatibility-list'
import { entityIgnoreDeath, entityStatic, getEntityTypeId } from '../../misc/entity-netid'
import { createNetTransportClient } from '../../net/net-transport'
import { profile } from '../../misc/profile-decorator'

import './ignore-pause-screen'
import './entity-physics-forcer'
import './injects'

export interface RemoteServerConnectionSettings {
    host: string
    port: number
    https?: boolean
}
export function isRemoteServerConnectionSettings(data: unknown): data is RemoteServerConnectionSettings {
    if (!data || typeof data !== 'object') return false
    if (!('host' in data) || typeof data.host !== 'string') return false
    if (!('port' in data) || typeof data.port !== 'number') return false

    return true
}

export interface RemoteServerSettings extends ServerSettings {
    netInfo: StrictNonNullable<NetServerInfoRemote>
    modCompatibility?: ModCompatibilityList
}

export interface ClientLeaveData {
    username: string
}
export function isClientLeaveData(data: unknown): data is ClientLeaveData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}

export class RemoteServer extends Server<RemoteServerSettings> {
    physics: boolean = false
    netManager!: NetManagerRemoteServer
    notifyReadyMaps?: MapName[]
    playerInfoEntries: Record<Username, PlayerInfoEntry> = {}

    constructor(settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super(settings)
        this.destroyOnLastClientLeave = true
    }

    async start() {
        assert(REMOTE)
        if (!REMOTE) return

        await super.start()

        if (this.settings.modCompatibility) applyModCompatibilityList(this.inst, this.settings.modCompatibility)

        TemporarySet.resetAll()
    }

    @profile()
    async startNet() {
        const transportClient = createNetTransportClient(this.settings.netInfo.details.transport)

        this.netManager = new NetManagerRemoteServer(this.settings.netInfo.connection, transportClient)
        await this.netManager.start()

        this.measureTraffic = Opts.showPacketNetworkTraffic

        this.startShell()
    }

    update() {
        super.update()
        sendRemoteServerPacket()
    }

    async onNetDisconnect() {
        if (this.destroyed) return
        console.log('server disconnected')
        await multi.destroyNextFrameAndStartLoop()
        DEV || sc.Dialogs.showErrorDialog('Disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        try {
            let packet: PhysicsServerUpdatePacket
            if (this.settings.netInfo.details.forceJsonCommunication) {
                packet = data as any
            } else {
                const buf = new Uint8Array(data as ArrayBuffer)
                packet = PhysicsUpdatePacketEncoderDecoder.decode(buf)
            }

            // if (buf.length > 100) {
            //     const json = JSON.stringify(packet)
            //     console.log(
            //         'big packet!',
            //         'buf size:',
            //         buf.length,
            //         'json buf size:',
            //         new TextEncoder().encode(json).byteLength,
            //         '\n',
            //         json
            //     )
            // }
            this.processPacket(conn, packet)
        } catch (e) {
            console.error(`Error applying packet!`, e)
        }
    }

    private async resetMapState(map: CCMap) {
        runTask(map.inst, () => {
            for (const entity of map.inst.ig.game.entities) {
                if (!entity.netid) continue
                const type = getEntityTypeId(entity.netid)
                if (!entityStatic.has(type) && !entityIgnoreDeath.has(type)) {
                    entity.kill()
                }
            }
        })

        await Promise.all(
            map.clients.map(async client => {
                const joinData: ClientJoinData = {
                    username: client.username,
                    initialInputType: client.inputManager.inputType ?? ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE,
                }
                await this.netManager.sendJoin(joinData)
            })
        )
    }

    private processPacket(_conn: NetConnection, data: PhysicsServerUpdatePacket) {
        const msPing = this.netManager.calculatePing(data.sendAt)
        for (const client of this.clients.values()) {
            client.lastPingMs = msPing
        }

        // if (Object.keys(cleanRecord(data) ?? {}).length > 1) {
        //     console.log(JSON.stringify(data, null, 4))
        // }

        if (data.global) {
            try {
                applyGlobalStateUpdatePacket(data.global)
            } catch (e) {
                this.onInstanceUpdateError(e)
            }
        }

        for (const mapName in data.mapPackets) {
            const stateUpdatePacket = data.mapPackets[mapName]

            const map = multi.server.maps.get(mapName)
            assert(map?.initialized)

            if (stateUpdatePacket.crash) {
                if (stateUpdatePacket.crash.tryReconnect) {
                    this.resetMapState(map)
                }
                continue
            }

            runTask(map.inst, () => {
                try {
                    applyStateUpdatePacket(stateUpdatePacket, ig.system.tick, map.noStateAppliedYet)
                } catch (e) {
                    this.onInstanceUpdateError(e)
                }
                map.noStateAppliedYet = false
            })
        }
    }

    async createAndJoinClient(
        joinData: ClientJoinData,
        { connection, awaitClientJoin, clientSettingsOverride, ackDataOverride }: ClientCreateAndJoinSettings = {}
    ): Promise<{ ackData: ClientJoinAckData; client?: Client; map?: CCMap }> {
        let ackData = this.createAndJoinClientInitialChecks(joinData)
        if (ackData) return { ackData }

        assert(!clientSettingsOverride)

        ackData = ackDataOverride ?? (await this.netManager.sendJoin(joinData))
        if (ackData.status != 'ok') return { ackData }

        const settings: ClientSettings = {
            username: joinData.username,
            inputType: 'clone',
            remote: false,
            initialInputType: joinData.initialInputType,
            tpInfo: ackData.tpInfo,
        }

        const client = new Client(settings)
        const tpInfo = client.getInitialTpInfo()
        const map = this.getMap(tpInfo.map)

        assert(ackData.reservedNetid)
        client.reservedNetid = ackData.reservedNetid

        this.baseInst.display = false

        await this.initAndJoinClientStrategy(client, tpInfo, connection, awaitClientJoin)

        assert(this.netManager.conn)
        this.netManager.conn.join(client)

        return { client, map, ackData }
    }

    onMapReady(map: CCMap) {
        ;(this.notifyReadyMaps ??= []).push(map.name)
    }

    async leaveClient(client: Client) {
        super.leaveClient(client)

        this.netManager.sendLeave({ username: client.username })
    }

    getPlayerInfoOf(username: Username): PlayerInfoEntry {
        const entry = this.playerInfoEntries[username]
        assert(entry, `getPlayerInfoEntry: asked for username: ${username} that has no entry!`)
        return entry
    }

    getPlayerInfoEntries() {
        return this.playerInfoEntries
    }

    destroy() {
        super.destroy()
        this.netManager.destroy?.()
    }
}
