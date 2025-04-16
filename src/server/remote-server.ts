import { assert } from '../misc/assert'
import { NetConnection } from '../net/connection'
import { SocketNetManagerRemoteServer } from '../net/socket'
import { prestart } from '../plugin'
import { applyEntityStates } from '../state/states'
import { ClientJoinData } from './physics-server'
import { RemoteServerUpdatePacket } from './physics-server-sender'
import { Server, ServerSettings } from './server'

export interface RemoteServerSettings extends ServerSettings {
    socketSettings?: {
        host: string
        port: number
    }
}

export class RemoteServer extends Server<RemoteServerSettings> {
    netManager!: SocketNetManagerRemoteServer

    constructor(public settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super()
    }

    async start() {
        await super.start()

        if (this.settings.socketSettings) {
            this.netManager = new SocketNetManagerRemoteServer(
                this.settings.socketSettings.host,
                this.settings.socketSettings.port
            )
        } else assert(false)

        await this.netManager.connect()
    }

    private async createClient(username: string) {
        const client = await this.createAndJoinClient({
            username,
            inputType: 'puppet',
        })

        const data: ClientJoinData = {
            username,
        }
        await this.netManager.sendJoin(data, client)
    }

    async onNetConnected() {
        await this.createClient('client')
    }

    onNetDisconnect() {
        console.log('server disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        // console.log(`received packet from`, conn.instanceId, `:`, data)
        this.processPacket(conn.instanceId, data as RemoteServerUpdatePacket)
    }

    onNetClose(conn: NetConnection) {
        this.clientsById[conn.instanceId].destroy()
    }

    private processPacket(instanceId: number, data: RemoteServerUpdatePacket) {
        const inst = instanceinator.instances[instanceId]
        assert(inst)
        const prevId = instanceinator.id
        inst.apply()
        applyEntityStates(data.mapPacket.entities)
        instanceinator.instances[prevId].apply()
    }

    async destroy() {
        if (this.netManager) await this.netManager.destroy()
        await super.destroy()
    }
}

prestart(() => {
    ig.Physics.inject({
        update() {
            if (multi.server instanceof RemoteServer) return
            this.parent()
        },
    })
})

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof RemoteServer && ig.netConnection) {
                // const data = {
                //     hi: 'hello',
                // }
                // ig.netConnection.sendUpdate(data)
            }
        },
    })
})
