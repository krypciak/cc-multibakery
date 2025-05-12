import { assert } from '../../misc/assert'
import { NetConnection } from '../../net/connection'
import { SocketNetManagerRemoteServer } from '../../net/socket'
import { prestart } from '../../plugin'
import { applyEntityStates } from '../../state/states'
import { ClientJoinAckData, ClientJoinData } from '../physics/physics-server'
import { PhysicsServerUpdatePacket } from '../physics/physics-server-sender'
import { Server, ServerSettings } from '../server'

import './remote-server-sender'
import { Client } from '../../client/client'
import { getDummyUuidByUsername } from '../../dummy/dummy-player'
import { NetServerInfoRemote } from '../../client/menu/server-info'
import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { showClientErrorPopup } from '../../client/menu/error-popup'
import { Opts } from '../../options'

export type RemoteServerConnectionSettings = {
    host: string
    port: number
} & {
    type: 'socket'
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

        instanceinator.displayId = true
        instanceinator.displayFps = true

        const connS = this.settings.connection
        if (connS.type == 'socket') {
            this.netManager = new SocketNetManagerRemoteServer(connS.host, connS.port)
        } else assert(false)

        await this.netManager.connect()
        this.measureTraffic = Opts.showPacketNetworkTraffic
    }

    onInstanceUpdateError(inst: InstanceinatorInstance, error: unknown, whenApplingPacket?: boolean): never {
        showClientErrorPopup(inst, error, whenApplingPacket)
        super.onInstanceUpdateError(inst, error)
    }

    async tryJoinRemote(joinData: ClientJoinData): Promise<ClientJoinAckData> {
        const ackData = await this.netManager.sendJoin(joinData)
        if (ackData.status == 'ok') {
            this.baseInst.display = false
            const client = await this.createAndJoinClient({
                username: joinData.username,
                inputType: 'clone',
            })
            assert(this.netManager.conn)
            this.netManager.conn.join(client)
        }

        return ackData
    }

    async onNetDisconnect() {
        console.log('server disconnected')
        await multi.destroyAndStartLoop()
        sc.Dialogs.showErrorDialog('Disconnected')
    }

    onNetReceive(conn: NetConnection, data: unknown) {
        try {
            this.processPacket(conn, data as PhysicsServerUpdatePacket)
        } catch (e) {
            console.error(`Error applying packet!`, e)
        }
    }

    private processPacket(_conn: NetConnection, data: PhysicsServerUpdatePacket) {
        const unreadyClientPlayers: string[] = Object.keys(this.unreadyClients).map(getDummyUuidByUsername)

        const msPing = Date.now() - data.sendAt
        for (const username in this.clients) {
            const client = this.clients[username]
            client.lastPingMs = msPing
        }

        for (const mapName in data.mapPackets) {
            const mapPacket = data.mapPackets[mapName]

            const map = multi.server.maps[mapName]
            if (!map?.ready) continue

            const prevId = instanceinator.id
            const inst = map.inst

            /* prevent spawning dummies of clients that are initializing at the moment */
            /* this is ugly, could this be done in a cleaner way? */
            for (const uuid of unreadyClientPlayers) {
                if (mapPacket.entities.states?.[uuid]) delete mapPacket.entities.states?.[uuid]
            }

            assert(inst)
            inst.apply()
            try {
                applyEntityStates(mapPacket.entities, data.tick, map.noStateAppliedYet)
            } catch (e) {
                this.onInstanceUpdateError(inst, e, true)
            }
            map.noStateAppliedYet = false
            instanceinator.instances[prevId].apply()
        }
    }

    async leaveClient(client: Client) {
        await super.leaveClient(client)
        if (Object.keys(this.clients).length == 0) {
            await multi.destroyAndStartLoop()
        }
    }

    async destroy() {
        await this.netManager.destroy?.()
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

declare global {
    namespace multi {
        function tryJoinRemote(serverInfo: NetServerInfoRemote, joinData: ClientJoinData): Promise<ClientJoinAckData>
    }
}
prestart(() => {
    multi.tryJoinRemote = async (serverInfo: NetServerInfoRemote, joinData: ClientJoinData) => {
        {
            const server = multi.server
            assert(!server)
        }
        assert(serverInfo.details)

        const server = new RemoteServer({
            globalTps: serverInfo.details.globalTps,
            displayServerInstance: false,
            displayMaps: false,
            displayClientInstances: true,
            forceConsistentTickTimes: false,
            connection: serverInfo.connection,
        })
        multi.setServer(server)
        await server.start()

        const ack = await server.tryJoinRemote(joinData)
        if (ack.status != 'ok') {
            await multi.destroyAndStartLoop()
        }
        return ack
    }
})
