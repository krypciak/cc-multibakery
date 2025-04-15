import { assert } from '../misc/assert'
import { SocketNetClient } from '../net/socket'
import { ClientJoinData } from './physics-server'
import { Server, ServerSettings } from './server'

export interface RemoteServerSettings extends ServerSettings {
    socketSettings?: {
        host: string
        port: number
    }
}

const username = 'client'
export class RemoteServer extends Server<RemoteServerSettings> {
    netManager!: SocketNetClient

    constructor(public settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super()
    }

    async start() {
        await super.start()

        if (this.settings.socketSettings) {
            this.netManager = new SocketNetClient(this.settings.socketSettings.host, this.settings.socketSettings.port)
        } else assert(false)

        await this.netManager.connect()
    }

    async onNetConnected() {
        const client = await this.createAndJoinClient({
            username,
            inputType: 'puppet',
        })
        console.log(client.inst.id)

        const data: ClientJoinData = {
            username,
        }
        await this.netManager.sendJoin(data)
    }

    onNetDisconnect() {}

    update() {
        
    }

    async destroy() {
        if (this.netManager) await this.netManager.destroy()
        await super.destroy()
    }
}
