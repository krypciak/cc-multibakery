import { NetConnection } from '../net/connection'
import { SocketNetManagerLocalServer } from '../net/socket'
import { Server, ServerSettings } from './server'

export interface PhysicsServerSettings extends ServerSettings {
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
    constructor(public settings: PhysicsServerSettings) {
        super()
    }

    async start() {
        await super.start()

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
        this.leaveClient(conn.instanceId)
    }
}
