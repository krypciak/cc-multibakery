import { NetConnection, NetManagerPhysicsServer } from '../../net/connection'
import { SocketNetManagerPhysicsServer } from '../../net/socket'
import { ClientJoinAckData, ClientJoinData, Server, ServerSettings } from '../server'
import { isRemoteServerUpdatePacket, RemoteServerUpdatePacket } from '../remote/remote-server-sender'
import { assert } from '../../misc/assert'
import { NetServerInfoPhysics } from '../../client/menu/server-info'
import { PhysicsHttpServer } from '../../net/web-server'
import { Client } from '../../client/client'
import { startRepl } from './shell'
import { isUsernameValid } from '../../misc/username-util'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { Opts } from '../../options'
import { CCBundlerModuleOptions } from '../../net/cc-bundler-http-modules'

import './physics-server-sender'

export interface PhysicsServerConnectionSettings {
    httpPort: number
    httpRoot?: string
    ccbundler?: CCBundlerModuleOptions
    https?: import('https').ServerOptions

    type: 'socket'
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean
    attemptCrashRecovery?: boolean
    netInfo?: NetServerInfoPhysics
}

export class PhysicsServer extends Server<PhysicsServerSettings> {
    remote = false
    netManager?: NetManagerPhysicsServer
    httpServer?: PhysicsHttpServer

    connectionReadyMaps: WeakMap<NetConnection, Set<string>> = new WeakMap()

    constructor(public settings: PhysicsServerSettings) {
        console.info('ROLE: PhysicsServer')
        super()
    }

    async start() {
        await super.start()

        this.baseInst.display = false
        this.attemptCrashRecovery = this.settings.attemptCrashRecovery ?? Opts.physicsAttemptCrashRecovery

        if (!window.crossnode?.options.test) {
            await this.createAndJoinClient({
                username: `lea_${1}`,
                inputType: 'clone',
                remote: false,
            })
            this.masterUsername = `lea_${1}`
            // await this.createAndJoinClient({
            //     username: `lea_${2}`,
            //     inputType: 'clone',
            //     remote: false,
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
        if (PHYSICSNET && netInfo) {
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

        // if (!window.crossnode?.options.test) {
        //     stagePvp()
        // }
    }

    async tryJoinClient(
        joinData: ClientJoinData,
        remote: boolean
    ): Promise<{ ackData: ClientJoinAckData; client?: Client }> {
        const username = joinData.username

        if (joinData.stepCount != multi.stepCount)
            return { ackData: { status: joinData.stepCount > multi.stepCount ? 'step_count_high' : 'step_count_low' } }
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
        if (!isRemoteServerUpdatePacket(data)) {
            console.warn('invalid update packet received from', conn.clients, ', contents: ', data, ', closing')
            conn.close()
            return
        }
        this.processPacket(conn, data)
    }

    private processPacket(conn: NetConnection, data: RemoteServerUpdatePacket) {
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
            const client = multi.server.clients[username]
            if (!client) continue
            const inp = client.player.inputManager
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

    onNetDisconnect(conn: NetConnection) {
        for (const client of conn.clients) {
            this.leaveClient(client)
        }
    }

    destroy() {
        super.destroy()
        this.netManager?.destroy()
        this.httpServer?.destroy()
    }
}
