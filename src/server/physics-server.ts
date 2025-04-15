import { NetConnection, NetManagerLocalServer } from '../net/connection'
import { SocketNetManagerLocalServer } from '../net/socket'
import { Server, ServerSettings } from './server'

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
    netManager?: NetManagerLocalServer

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
            this.netManager = new SocketNetManagerLocalServer(this.settings.socketSettings.port)
        }

        if (this.netManager) {
            await this.netManager.start()
        }
    }

    async onNetJoin(
        data: ClientJoinData
    ): Promise<{ id: number; error?: undefined } | { id?: undefined; error: string }> {
        const username = data.username
        if (this.clients[username]) return { error: 'username taken' }

        const client = await this.createAndJoinClient({
            username,
            inputType: 'puppet',
            // noShowInstance: true,
            // forceDraw: true,
        })
        return { id: client.inst.id }
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        console.log(`received packet from`, conn.instanceId, `:`, data)
    }
    onNetClose(conn: NetConnection) {
        this.clientsById[conn.instanceId].destroy()
    }

    async destroy() {
        if (this.netManager) await this.netManager.destroy()
        await super.destroy()
    }
}
