import { NetConnection, NetManagerPhysicsServer } from '../net/connection'
import { SocketNetManagerPhysicsServer } from '../net/socket'
import { Server, ServerSettings } from './server'
import './physics-server-sender'
import { Client } from '../client/client'

export interface PhysicsServerSettings extends ServerSettings {
    name: string
    godmode?: boolean
    slotName?: string

    socketSettings?: {
        port: number
    }
}

export interface ClientJoinData {
    username: string
}
export function isClientJoinData(data: unknown): data is ClientJoinData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}

export class PhysicsServer extends Server<PhysicsServerSettings> {
    netManager?: NetManagerPhysicsServer

    constructor(public settings: PhysicsServerSettings) {
        console.info('ROLE: PhysicsServer')
        super()
    }

    async start() {
        await super.start()

        if (!window.crossnode?.options.test) {
            // await this.createAndJoinClient({
            //     username: `lea_${1}`,
            // })
            // await this.createAndJoinClient({
            //     username: `lea_${2}`,
            //     inputType: 'puppet',
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

        if (this.settings.socketSettings) {
            this.netManager = new SocketNetManagerPhysicsServer(this.settings.socketSettings.port)
        }

        if (this.netManager) {
            await this.netManager.start()
        }
    }

    async onNetJoin(
        data: ClientJoinData
    ): Promise<{ client: Client; error?: undefined } | { client?: undefined; error: string }> {
        const username = data.username
        if (this.clients[username]) return { error: 'username taken' }

        const client = await this.createAndJoinClient({
            username,
            inputType: 'puppet',
            remote: true,
            // noShowInstance: true,
            // forceDraw: true,
        })
        return { client }
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        console.log(`received packet from`, conn.clients, `:`, data)
    }

    onNetDisconnect(conn: NetConnection) {
        for (const client of conn.clients) {
            this.leaveClient(client)
        }
    }

    async destroy() {
        if (this.netManager) await this.netManager.destroy()
        await super.destroy()
    }
}
