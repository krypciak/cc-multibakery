import { assert } from '../misc/assert'
import { NetConnection } from '../net/connection'
import { SocketNetManagerRemoteServer } from '../net/socket'
import { prestart } from '../plugin'
import { applyEntityStates } from '../state/states'
import { ClientJoinData } from './physics-server'
import { RemoteServerUpdatePacket } from './physics-server-sender'
import { Server, ServerSettings } from './server'

import './remote-server-sender'
import { Client } from '../client/client'

export type RemoteServerConnectionSettings = {
    type: 'socket'
    host: string
    port: number
}

export interface RemoteServerSettings extends ServerSettings {
    connection: RemoteServerConnectionSettings
}

export class RemoteServer extends Server<RemoteServerSettings> {
    netManager!: SocketNetManagerRemoteServer

    constructor(public settings: RemoteServerSettings) {
        console.info('ROLE: RemoteServer')
        super()
    }

    async start() {
        await super.start()

        const connS = this.settings.connection
        if (connS.type == 'socket') {
            this.netManager = new SocketNetManagerRemoteServer(connS.host, connS.port)
        } else assert(false)

        await this.netManager.connect()
    }

    private async createClient(username: string) {
        const client = await this.createAndJoinClient({
            username,
            inputType: 'clone',
        })

        const data: ClientJoinData = {
            username,
        }
        await this.netManager.sendJoin(data, client)
    }

    async onNetConnected() {
        const id = (100 + determine.instances[0].general() * 900).floor()
        await this.createClient(`client${id}`)
        // await this.createClient('client2')
    }

    onNetDisconnect() {
        console.log('server disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        this.processPacket(conn, data as RemoteServerUpdatePacket)
    }

    private processPacket(_conn: NetConnection, data: RemoteServerUpdatePacket) {
        for (const mapName in data.mapPackets) {
            const mapPacket = data.mapPackets[mapName]

            const map = multi.server.maps[mapName]
            assert(map)

            const prevId = instanceinator.id
            const inst = map.inst
            assert(inst)
            inst.apply()
            applyEntityStates(mapPacket.entities, data.tick)
            instanceinator.instances[prevId].apply()
        }
    }

    async leaveClient(client: Client) {
        await super.leaveClient(client)
        if (Object.keys(this.clients).length == 0) {
            await multi.destroy()
        }
    }

    async destroy() {
        if (this.netManager) await this.netManager.destroy()
        await super.destroy()
    }
}

prestart(() => {
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof RemoteServer /* && ig.netConnection */) {
                // const data = {
                //     hi: 'hello',
                // }
                // ig.netConnection.sendUpdate(data)
            }
        },
    })
})

/* for client */
prestart(() => {
    ig.EventManager.inject({
        update() {
            // TEMP fix todo
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            this.clear()
        },
    })
    ig.CollEntry.inject({
        // @ts-expect-error
        update() {
            if (multi.server instanceof RemoteServer) return
            // @ts-expect-error
            this.parent()
        },
    })
}, 3)
