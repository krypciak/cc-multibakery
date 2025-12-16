import { assert } from '../../misc/assert'
import type { NetConnection } from '../../net/connection'
import { SocketNetManagerRemoteServer } from '../../net/socket'
import { applyGlobalStateUpdatePacket, applyStateUpdatePacket } from '../../state/states'
import type { PhysicsServerUpdatePacket } from '../physics/physics-server-sender'
import { type ClientJoinAckData, type ClientJoinData, Server, type ServerSettings } from '../server'
import type { Client } from '../../client/client'
import { Opts } from '../../options'
import { TemporarySet } from '../../misc/temporary-set'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { sendRemoteServerPacket } from './remote-server-sender'
import { PhysicsUpdatePacketEncoderDecoder } from '../../net/binary/physics-update-packet-encoder-decoder.generated'
import { applyModCompatibilityList, type ModCompatibilityList } from '../mod-compatibility-list'
import { entityIgnoreDeath, entityStatic, getEntityTypeId } from '../../misc/entity-netid'
import type { CCMap } from '../ccmap/ccmap'
import type { MapName, Username } from '../../net/binary/binary-types'

import './ignore-pause-screen'
import './entity-physics-forcer'
import './injects'
import type { PlayerInfoEntry } from '../../party/party'

export interface RemoteServerConnectionSettings {
    host: string
    port: number
    https?: boolean
    type: 'socket'
    forceJsonCommunication?: boolean
}

export interface RemoteServerSettings extends ServerSettings {
    connection: RemoteServerConnectionSettings
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
    netManager!: SocketNetManagerRemoteServer
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
        connection?: NetConnection
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        assert(!connection)

        const ackData = await this.netManager.sendJoin(joinData)
        let client: Client | undefined
        if (ackData.status == 'ok') {
            this.baseInst.display = false
            client = await this.createAndJoinClient({
                username: joinData.username,
                inputType: 'clone',
                remote: false,
                initialInputType: joinData.initialInputType,
                tpInfo: { map: ackData.mapName! },
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

        if (data.global) {
            try {
                applyGlobalStateUpdatePacket(data.global)
            } catch (e) {
                this.onInstanceUpdateError(e)
            }
        }

        // if (data.mapPackets) console.log(JSON.stringify(data.mapPackets, null, 4))
        for (const mapName in data.mapPackets) {
            const stateUpdatePacket = data.mapPackets[mapName]

            const map = multi.server.maps.get(mapName)
            assert(map?.ready)

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

    async loadMap(name: string) {
        const map = await super.loadMap(name)
        ;(this.notifyReadyMaps ??= []).push(name)
        return map
    }

    async leaveClient(client: Client) {
        super.leaveClient(client)

        this.netManager.sendLeave({ username: client.username })
    }

    getPlayerInfoOf(username: Username): PlayerInfoEntry {
        const entry = this.playerInfoEntries[username]
        assert(`getPlayerInfoEntry: asked for username: ${username} that has no entry!`)
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
