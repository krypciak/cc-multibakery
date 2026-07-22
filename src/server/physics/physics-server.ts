import type { NetConnection } from '../../net/net-connection'
import { NetManagerPhysicsServer } from '../../net/net-manager-physics'
import type { ClientCreateAndJoinSettings, ClientJoinAckData, ClientJoinData, ServerSettings } from '../server-types'
import { Server } from '../server'
import { isRemoteServerUpdatePacket, type RemoteServerUpdatePacket } from '../remote/remote-server-sender'
import { assert } from '../../misc/assert'
import type { NetServerInfoPhysics } from '../../client/menu/server-info-types'
import { PhysicsHttpServer } from '../../net/web-server'
import { Client, type ClientSettings } from '../../client/client'
import { runTask } from 'cc-instanceinator/src/inst-util'
import type { CrosscodeWebModuleOptions } from '../../net/crosscode-web-http-modules'
import type { ClientLeaveData } from '../remote/remote-server-types'
import { startGameLoop } from '../../game-loop'
import { sendPhysicsServerPacket } from './physics-server-sender'
import { RemoteUpdatePacketEncoderDecoder } from '../../net/binary/remote-update-packet-encoder-decoder.generated'
import type { MapName, Username } from '../../net/binary/binary-types'
import { loadClientOptionModelState } from '../../client/client-option-model-link'
import { ServerDiscoveryServer } from '../../net/server-discovery'
import type { PlayerInfoEntry } from '../../state/player-info'
import { createNetTransportServer, type NetTransportServerSettings } from '../../net/net-transport'
import type { CCMap } from '../ccmap/ccmap'
import {
    registerChargeTimingsChangeListener,
    unregisterChargeTimingsChangeListener,
} from '../../mod-compatibility/cc-variable-charge-time'

import './physics-server-sender'
import './storage/storage'
import './disable-idle-pose'
import './event/event'

export interface PhysicsServerConnectionSettings {
    httpPort: number
    crosscodeWeb?: CrosscodeWebModuleOptions
    https?: { cert: string; key: string }

    pingInterval?: number
    pingTimeout?: number

    transport: NetTransportServerSettings
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean
    netInfo?: NetServerInfoPhysics
    save?: {
        manualSaving?: boolean
        loadFromSlot?: number
        loadSaveData?: ig.SaveSlot.Data
        automaticallySave?: boolean
    }
    disablePlayerIdlePose?: boolean
    copyNewPlayerStats?: boolean

    /* when this is true, forceConsistentTickTimes is forced off */
    useAnimationFrameLoop?: boolean
}

export class PhysicsServer extends Server<PhysicsServerSettings> {
    physics: boolean = true
    netManager?: NetManagerPhysicsServer
    httpServer?: PhysicsHttpServer
    serverDiscovery?: ServerDiscoveryServer
    anyRemoteClientsOn: boolean = false

    connectionReadyMaps: WeakMap<NetConnection, Set<MapName>> = new WeakMap()

    constructor(settings: PhysicsServerSettings) {
        console.info('ROLE: PhysicsServer')

        if (settings.useAnimationFrameLoop && !window.requestAnimationFrame) {
            settings.useAnimationFrameLoop = false
            // console.warn('useAnimationFrameLoop is enabled, but window.requestAnimationFrame is undefined! defaulting to setInterval')
        }

        if (settings.useAnimationFrameLoop) {
            settings.forceConsistentTickTimes = false
        }
        super(settings)
    }

    async start() {
        await super.start(!!this.settings.useAnimationFrameLoop)

        this.baseInst.display = false

        multi.storage.load()
        registerChargeTimingsChangeListener()

        this.startNet()
    }

    private async startNet() {
        const netInfo = this.settings.netInfo
        if (PHYSICSNET && netInfo) {
            this.httpServer = new PhysicsHttpServer(netInfo)
            await this.httpServer.start()

            const transportServer = createNetTransportServer(netInfo.connection.transport)

            this.netManager = new NetManagerPhysicsServer(transportServer)
            await this.netManager.start(netInfo, this.httpServer.httpServer)

            if (netInfo.discovery) {
                this.serverDiscovery = new ServerDiscoveryServer()
                this.serverDiscovery.start()
            }
        }

        this.startShell()
    }

    update() {
        super.update()

        sendPhysicsServerPacket()
    }

    private updateAnyRemoteClientsOn() {
        if (!this.netManager) return (this.anyRemoteClientsOn = false)

        const anyRemoteClientsOn = [...this.clients.values()].some(c => c.settings.remote)
        if (this.anyRemoteClientsOn != anyRemoteClientsOn) {
            this.anyRemoteClientsOn = anyRemoteClientsOn
            if (this.settings.useAnimationFrameLoop) {
                startGameLoop(!anyRemoteClientsOn)
            }
        }
    }

    joinClient(client: Client) {
        super.joinClient(client)
        this.updateAnyRemoteClientsOn()
    }

    async createAndJoinClient(
        joinData: ClientJoinData,
        { connection, awaitClientJoin, clientSettingsOverride, ackDataOverride }: ClientCreateAndJoinSettings = {}
    ): Promise<{ ackData: ClientJoinAckData; client?: Client; map?: CCMap }> {
        let ackData = this.createAndJoinClientInitialChecks(joinData)
        if (ackData) return { ackData }
        assert(!ackDataOverride)

        const settings: ClientSettings = {
            username: joinData.username,
            inputType: connection ? 'puppet' : 'clone',
            remote: !!connection,
            initialInputType: joinData.initialInputType,
            tpInfo: this.validatePreferredMap(joinData.preferredTpInfo, connection),
            ...(clientSettingsOverride ?? {}),
        }

        const client = new Client(settings)
        const tpInfo = client.getInitialTpInfo()
        const map = this.getMap(tpInfo)

        client.reservedNetid = map.reservePlayerNetid()

        await this.initAndJoinClientStrategy(client, tpInfo, connection, awaitClientJoin)

        ackData = { status: 'ok', tpInfo, reservedNetid: client.reservedNetid }
        return { client, map, ackData }
    }

    leaveClient(client: Client, reason?: string) {
        super.leaveClient(client, reason)
        this.updateAnyRemoteClientsOn()
    }

    onNetReceiveUpdate(conn: NetConnection, data: unknown) {
        let packet: RemoteServerUpdatePacket
        try {
            if (this.settings.netInfo!.details.forceJsonCommunication) {
                packet = data as any
            } else {
                const buf = new Uint8Array(data as ArrayBuffer)
                packet = RemoteUpdatePacketEncoderDecoder.decode(buf)
            }

            if (!isRemoteServerUpdatePacket(packet)) {
                throw new Error('invalid json packet')
            }
        } catch (e) {
            console.log(e)
            console.warn('invalid update packet received from', conn.clients, ', contents: ', data, ', closing')
            conn.close()
            return
        }
        this.processUpdatePacket(conn, packet)
    }

    private processUpdatePacket(conn: NetConnection, data: RemoteServerUpdatePacket) {
        if (data.readyMaps) {
            let entry = this.connectionReadyMaps.get(conn)
            if (!entry) {
                entry = new Set()
                this.connectionReadyMaps.set(conn, entry)
            }
            for (const map of data.readyMaps) {
                entry.add(map)
            }
        }
        for (const username in data.clients) {
            const client = multi.server.clients.get(username)
            if (!client) continue
            const inp = client.inputManager
            assert(inp instanceof dummy.input.Puppet.InputManager)

            const packet = data.clients[username]
            if (!packet) continue

            if (client.inst.ig.inPauseScreen) {
                runTask(client.inst, () => sc.model.enterRunning())
            }

            if (packet.input) {
                inp.mainInputData.pushInput(packet.input)
            }
            if (packet.gamepad) {
                inp.mainGamepadManagerData.pushInput(packet.gamepad)
            }

            if (packet.inputFieldText !== undefined) {
                const text = packet.inputFieldText
                runTask(client.inst, () => {
                    ig.shownInputDialog?.setText(text)
                })
            }

            if (packet.options) {
                loadClientOptionModelState(client, packet.options)
            }
        }
    }

    onNetClientLeave(conn: NetConnection, data?: ClientLeaveData) {
        let clients: Client[]
        if (data) {
            const client = conn.clients.find(client => client.username == data.username)
            if (client) {
                clients = [client]
            } else {
                clients = []
            }
        } else {
            clients = conn.clients
        }

        for (const client of clients) {
            conn.leave(client)
            this.leaveClient(client)
        }
    }

    getPlayerInfoOf(username: Username): PlayerInfoEntry {
        const client = multi.server.clients.get(username)
        assert(client?.dummy)
        const model = client.dummy.model
        const mapSize: Vec2 = client.getMap().inst.ig.game.size
        return {
            username: client.username,
            character: model.name,
            tpInfo: client.tpInfo,
            nextTpInfo: client.nextTpInfo,
            netid: client.reservedNetid ?? client.dummy?.netid,
            pos: {
                x: client.dummy.coll.pos.x / mapSize.x,
                y: (client.dummy.coll.pos.y - client.dummy.coll.pos.z) / mapSize.y,
            },

            stats: {
                level: model.level,
                maxhp: model.params.getStat('hp'),
                attack: model.params.getStat('attack'),
                defense: model.params.getStat('defense'),
                focus: model.params.getStat('focus'),

                hp: model.params.currentHp,
                spLevel: model.params.maxSp,
                sp: model.params.currentSp,
                exp: model.exp,
            },
            equip: model.equip,
        }
    }

    getPlayerInfoEntries() {
        return Object.fromEntries(
            [...multi.server.clients.values()]
                .filter(client => client.dummy)
                .map(client => [client.username, this.getPlayerInfoOf(client.username)])
        )
    }

    destroy() {
        super.destroy()
        this.netManager?.destroy()
        this.httpServer?.destroy()
        this.serverDiscovery?.destroy()
        unregisterChargeTimingsChangeListener()
    }
}
