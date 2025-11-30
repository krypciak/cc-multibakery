import type { NetConnection, NetManagerPhysicsServer } from '../../net/connection'
import { SocketNetManagerPhysicsServer } from '../../net/socket'
import { type ClientJoinAckData, type ClientJoinData, type MapTpInfo, Server, type ServerSettings } from '../server'
import { isRemoteServerUpdatePacket, type RemoteServerUpdatePacket } from '../remote/remote-server-sender'
import { assert } from '../../misc/assert'
import type { NetServerInfoPhysics } from '../../client/menu/server-info'
import { PhysicsHttpServer } from '../../net/web-server'
import type { Client } from '../../client/client'
import { startRepl } from './shell'
import { isUsernameValid } from '../../misc/username-util'
import { runTask, runTasks } from 'cc-instanceinator/src/inst-util'
import type { CCBundlerModuleOptions } from '../../net/cc-bundler-http-modules'
import type { ClientLeaveData } from '../remote/remote-server'
import { startGameLoop } from '../../game-loop'
import { sendPhysicsServerPacket } from './physics-server-sender'
import { RemoteUpdatePacketEncoderDecoder } from '../../net/binary/remote-update-packet-encoder-decoder.generated'
import type { MapName } from '../../net/binary/binary-types'

import './physics-server-sender'
import './storage/storage'
import './disable-idle-pose'
import './event/event'
import './server-var-access'

export interface PhysicsServerConnectionSettings {
    httpPort: number
    httpRoot?: string
    ccbundler?: CCBundlerModuleOptions
    https?: import('https').ServerOptions

    type: 'socket'
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean
    netInfo?: NetServerInfoPhysics
    save?: {
        manualSaving?: boolean
        loadFromSlot?: number
        loadSaveData?: ig.SaveSlot.Data
        automaticlySave?: boolean
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
    anyRemoteClientsOn: boolean = false

    connectionReadyMaps: WeakMap<NetConnection, Set<MapName>> = new WeakMap()

    constructor(settings: PhysicsServerSettings) {
        console.info('ROLE: PhysicsServer')

        if (settings.useAnimationFrameLoop && !window.requestAnimationFrame) {
            settings.useAnimationFrameLoop = false
            console.warn(
                'useAnimationFrameLoop is enabled, but window.requestAnimationFrame is undefined! defaulting to setInterval'
            )
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
        this.registerVariableChargeTime()

        const netInfo = this.settings.netInfo
        if (PHYSICSNET && netInfo) {
            this.httpServer = new PhysicsHttpServer(netInfo)
            await this.httpServer.start()

            if (netInfo.connection.type == 'socket') {
                this.netManager = new SocketNetManagerPhysicsServer(netInfo, this.httpServer.httpServer)
            } else assert(false, 'not implemented')
        }

        if (this.netManager) {
            await this.netManager.start()
        }

        if (window.crossnode && !window.crossnode.tests) startRepl()
    }
    update() {
        super.update()

        sendPhysicsServerPacket()
    }

    private validatePrefferedMap(
        tpInfo: MapTpInfo | undefined,
        connection: NetConnection | undefined
    ): MapTpInfo | undefined {
        const map = tpInfo?.map
        if (!map || !this.maps.has(map)) return

        if (
            connection &&
            !connection.clients.some(client => client.tpInfo.map == tpInfo.map && client.tpInfo.marker == tpInfo.marker)
        ) {
            return
        }

        return tpInfo
    }

    async tryJoinClient(
        joinData: ClientJoinData,
        connection: NetConnection
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        assert(instanceinator.id == this.inst.id)
        const username = joinData.username

        if (!isUsernameValid(username)) return { ackData: { status: 'invalid_username' } }
        if (this.clients.has(username)) return { ackData: { status: 'username_taken' } }

        const tpInfo = this.validatePrefferedMap(joinData.prefferedTpInfo, connection)

        const client = await this.createAndJoinClient({
            username,
            inputType: connection ? 'puppet' : 'clone',
            remote: !!connection,
            initialInputType: joinData.initialInputType,
            tpInfo,
        })

        return { client, ackData: { status: 'ok', mapName: client.tpInfo.map } }
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

    protected joinClient(client: Client) {
        super.joinClient(client)
        this.updateAnyRemoteClientsOn()
    }

    leaveClient(client: Client) {
        super.leaveClient(client)
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

    destroy() {
        super.destroy()
        this.netManager?.destroy()
        this.httpServer?.destroy()
    }

    private registerVariableChargeTime() {
        /* cc-variable-charge-time */
        ig.onChargeTimingsOptionChange?.push(() => {
            const timings = ig.chargeTimings
            runTasks(
                [...this.maps.values()].map(map => map.inst),
                () => {
                    ig.setChargeTimings([...timings])
                }
            )
        })
    }
}
