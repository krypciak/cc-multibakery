import { NetConnection, NetManagerPhysicsServer } from '../../net/connection'
import { SocketNetManagerPhysicsServer } from '../../net/socket'
import { Server, ServerSettings } from '../server'
import { Client } from '../../client/client'
import { isRemoteServerUpdatePacket, RemoteServerUpdatePacket } from '../remote/remote-server-sender'
import { assert } from '../../misc/assert'
import { NetServerInfoPhysics } from '../../client/menu/server-info'
import { PhysicsHttpServer } from '../../net/web-server'

import './physics-server-sender'
import { startRepl } from './shell'

export type PhysicsServerConnectionSettings = {
    httpPort: number
    httpRoot?: string
} & {
    type: 'socket'
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean
    slotName?: string

    netInfo?: NetServerInfoPhysics
}

export interface ClientJoinData {
    username: string
}
export function isClientJoinData(data: unknown): data is ClientJoinData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}
export type ClientJoinAckData = {
    status: 'ok' | 'username_taken' | 'invalid_join_data'
}

export class PhysicsServer extends Server<PhysicsServerSettings> {
    netManager?: NetManagerPhysicsServer
    httpServer?: PhysicsHttpServer
    masterUsername?: string

    constructor(public settings: PhysicsServerSettings) {
        console.info('ROLE: PhysicsServer')
        super()
    }

    async start() {
        await super.start()

        this.baseInst.display = false

        if (!window.crossnode?.options.test) {
            // await this.createAndJoinClient({
            //     username: `lea_${1}`,
            //     inputType: 'clone',
            // })
            // await this.createAndJoinClient({
            //     username: `lea_${2}`,
            //     inputType: 'clone',
            //     forceInputType: ig.INPUT_DEVICES.GAMEPAD,
            // })
            // await this.createAndJoinClient({
            //     username: `lea_${3}`,
            //     inputType: 'clone',
            //     forceInputType: ig.INPUT_DEVICES.GAMEPAD,
            // })
            // let promises = []
            // for (let i = 2; i <= 20; i++) {
            //     promises.push(
            //         this.createAndJoinClient({
            //             username: `lea_${i}`,
            //             noShowInstance: true,
            //         })
            //     )
            // }
            // await Promise.all(promises)
        }

        const netInfo = this.settings.netInfo
        if (netInfo) {
            this.httpServer = new PhysicsHttpServer(netInfo)
            await this.httpServer.start()

            if (netInfo.connection.type == 'socket') {
                this.netManager = new SocketNetManagerPhysicsServer(this.httpServer.httpServer)
            } else assert(false, 'not implemented')
        }

        if (this.netManager) {
            await this.netManager.start()
        }

        if (window.crossnode) startRepl()
    }

    async onNetJoin(data: ClientJoinData): Promise<{ client: Client; ackData: ClientJoinAckData }> {
        const ackData = await this.processNetJoinRequest(data)
        const client = this.clients[data.username]
        if (ackData.status == 'ok') assert(client)
        return { client, ackData: ackData }
    }

    private async processNetJoinRequest(data: ClientJoinData): Promise<ClientJoinAckData> {
        const username = data.username
        if (this.clients[username]) return { status: 'username_taken' }

        await this.createAndJoinClient({
            username,
            inputType: 'puppet',
            remote: true,
            // noShowInstance: true,
            // forceDraw: true,
        })
        return { status: 'ok' }
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        // console.log(`received packet from`, conn.clients, `:`, data)
        if (!isRemoteServerUpdatePacket(data)) {
            console.warn('invalid update packet received from', conn.clients, ', contents: ', data, ', closing')
            conn.close()
            return
        }
        this.processPacket(conn, data)
    }

    private processPacket(_conn: NetConnection, data: RemoteServerUpdatePacket) {
        for (const username in data.input) {
            const client = multi.server.clients[username]
            if (!client) continue
            const inp = client.player.inputManager
            assert(inp instanceof dummy.input.Puppet.InputManager)

            const packet = data.input[username]
            inp.mainInput.pushInput(packet.input)
            if (packet.gamepad) {
                inp.mainGamepadManager.pushInput(packet.gamepad)
            }
        }
    }

    onNetDisconnect(conn: NetConnection) {
        for (const client of conn.clients) {
            this.leaveClient(client)
        }
    }

    async destroy() {
        await this.netManager?.destroy()
        await this.httpServer?.destroy()
        await super.destroy()
    }
}
