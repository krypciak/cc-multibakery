import { assert } from '../../misc/assert'
import { NetConnection } from '../../net/connection'
import { SocketNetManagerRemoteServer } from '../../net/socket'
import { applyStateUpdatePacket } from '../../state/states'
import { PhysicsServerUpdatePacket } from '../physics/physics-server-sender'
import { ClientJoinAckData, ClientJoinData, Server, ServerSettings } from '../server'
import { Client } from '../../client/client'
import { Opts } from '../../options'
import { TemporarySet } from '../../misc/temporary-set'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { sendRemoteServerPacket } from './remote-server-sender'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'

import './ignore-pause-screen'
import './entity-physics-forcer'
import './injects'
import { u8 } from 'ts-binarifier/src/type-aliases'

export interface RemoteServerConnectionSettings {
    host: string
    port: number
    https?: boolean
    type: 'socket'
    forceJsonCommunication?: boolean
}

export interface RemoteServerSettings extends ServerSettings {
    connection: RemoteServerConnectionSettings
}

export interface ClientLeaveData {
    username: string
}
export function isClientLeaveData(data: unknown): data is ClientLeaveData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}

export class RemoteServer extends Server<RemoteServerSettings> {
    remote = true
    netManager!: SocketNetManagerRemoteServer
    notifyReadyMaps?: string[]

    constructor(settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super(settings)
        this.destroyOnLastClientLeave = true
    }

    async start() {
        assert(REMOTE)
        if (!REMOTE) return

        await super.start()

        const connS = this.settings.connection
        if (connS.type == 'socket') {
            this.netManager = new SocketNetManagerRemoteServer(connS)
        } else assert(false)

        await this.netManager.connect()
        this.measureTraffic = Opts.showPacketNetworkTraffic

        TemporarySet.resetAll()
    }

    update() {
        super.update()
        sendRemoteServerPacket()
    }

    async tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        assert(!remote)

        const ackData = await this.netManager.sendJoin(joinData)
        let client: Client | undefined
        if (ackData.status == 'ok') {
            this.baseInst.display = false
            client = await this.createAndJoinClient({
                username: joinData.username,
                inputType: 'clone',
                remote,
                initialInputType: joinData.initialInputType,
                mapName: ackData.mapName,
            })
            assert(this.netManager.conn)
            this.netManager.conn.join(client)
        }

        return { client, ackData }
    }

    async onNetDisconnect() {
        if (this.destroyed) return
        console.log('server disconnected')
        await multi.destroyNextFrameAndStartLoop()
        sc.Dialogs.showErrorDialog('Disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        try {
            let packet: PhysicsServerUpdatePacket
            if (this.settings.connection.forceJsonCommunication) {
                packet = data as any
            } else {
                const buf = data as u8[]
                packet = PhysicsUpdatePacketEncoderDecoder.decode(buf as unknown as Uint8Array)
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

    private processPacket(_conn: NetConnection, data: PhysicsServerUpdatePacket) {
        const msPing = this.netManager.calculatePing(data.sendAt)
        for (const client of this.clients.values()) {
            client.lastPingMs = msPing
        }

        // if (data.mapPackets) console.log(JSON.stringify(data.mapPackets, null, 4))
        for (const mapName in data.mapPackets) {
            const stateUpdatePacket = data.mapPackets[mapName]

            const map = multi.server.maps.get(mapName)
            if (!map?.ready) continue

            runTask(map.inst, () => {
                try {
                    applyStateUpdatePacket(stateUpdatePacket, data.tick, map.noStateAppliedYet)
                } catch (e) {
                    this.onInstanceUpdateError(e)
                }
                map.noStateAppliedYet = false
            })
        }

        if (data.playerMaps) {
            // console.log(JSON.stringify(data.playerMaps, null, 4))
            for (const mapName in data.playerMaps) {
                const mapRecord = data.playerMaps[mapName]
                for (const username of mapRecord) {
                    const client = multi.server.clients.get(username)
                    assert(client)
                    client.teleport(mapName, undefined)
                }
            }
        }
    }

    async loadMap(name: string) {
        await super.loadMap(name)
        ;(this.notifyReadyMaps ??= []).push(name)
    }

    async leaveClient(client: Client) {
        super.leaveClient(client)

        this.netManager.sendLeave({ username: client.username })
    }

    destroy() {
        super.destroy()
        this.netManager.destroy?.()
    }
}
