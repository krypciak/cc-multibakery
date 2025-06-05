import { NetConnection, NetManagerPhysicsServer } from '../../net/connection'
import { SocketNetManagerPhysicsServer } from '../../net/socket'
import { ClientJoinAckData, ClientJoinData, Server, ServerSettings } from '../server'
import { isRemoteServerUpdatePacket, RemoteServerUpdatePacket } from '../remote/remote-server-sender'
import { assert } from '../../misc/assert'
import { NetServerInfoPhysics } from '../../client/menu/server-info'
import { PhysicsHttpServer } from '../../net/web-server'
import { Client } from '../../client/client'
import { startRepl } from './shell'

import './physics-server-sender'
import { isUsernameValid } from '../../misc/username-util'
import { setPauseScreenBlock } from '../remote/ignore-pause-screen'

export type PhysicsServerConnectionSettings = {
    httpPort: number
    httpRoot?: string
} & {
    type: 'socket'
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean

    netInfo?: NetServerInfoPhysics
}

export class PhysicsServer extends Server<PhysicsServerSettings> {
    remote = false
    netManager?: NetManagerPhysicsServer
    httpServer?: PhysicsHttpServer

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

        if (window.crossnode && !window.crossnode.tests) startRepl()
    }

    async tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        const username = joinData.username

        if (!isUsernameValid(username)) return { ackData: { status: 'invalid_username' } }
        if (this.clients[username]) return { ackData: { status: 'username_taken' } }

        const client = await this.createAndJoinClient({
            username,
            inputType: remote ? 'puppet' : 'clone',
            remote,
            initialInputType: joinData.initialInputType,
        })

        return { client, ackData: { status: 'ok' } }
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
            if (packet.exitPauseScreen) {
                setPauseScreenBlock(inp, false)

                client.inst.apply()
                sc.model.enterRunning()
                this.serverInst.apply()
            }

            inp.mainInputData.pushInput(packet.input)
            if (packet.gamepad) {
                inp.mainGamepadManagerData.pushInput(packet.gamepad)
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
