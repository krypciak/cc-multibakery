import type { Server as HttpServer } from 'http'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import { assert } from '../misc/assert'
import { isClientLeaveData } from '../server/remote/remote-server-types'
import { isClientJoinData } from '../server/server-types'
import { assertPhysics } from '../server/physics/physics-server-types'
import { PacketMiddleware, type PacketEventType } from './packet'
import { NetConnection } from './net-connection'
import { type NetTransport, type NetTransportListenerFunctions } from './net-transport'

export interface NetTransportServer {
    start(
        netInfo: NetServerInfoPhysics,
        httpServer: HttpServer,
        onConnection: (createNetTransport: (listeners: NetTransportListenerFunctions) => NetTransport) => void
    ): Promise<void>
    stop(): Promise<void>
}

export class NetManagerPhysicsServer {
    private stopFunc = () => this.stop()

    connections: NetConnection[] = []

    constructor(private transportServer: NetTransportServer) {}

    async start(netInfo: NetServerInfoPhysics, httpServer: HttpServer) {
        assert(PHYSICS)
        assert(PHYSICSNET)
        if (!PHYSICSNET) return
        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        await this.transportServer.start(netInfo, httpServer, this.registerEvents.bind(this))
    }

    private async registerEvents(createNetTransport: (listeners: NetTransportListenerFunctions) => NetTransport) {
        const server = multi.server
        assertPhysics(server)

        const onData = async (type: PacketEventType, data: any, callback?: (data: any) => void) => {
            if (server != multi.server) return

            if (type == 'update') {
                server.onNetReceiveUpdate(connection, data)
            } else if (type == 'join') {
                if (!callback) return
                if (!isClientJoinData(data)) return callback({ status: 'invalid_join_data' })
                const { ackData } = await server.createAndJoinClient(data, { connection })
                callback(ackData)
            } else if (type == 'ready') {
                connection.readyForSendingUpdate = true
            } else if (type == 'leave') {
                if (!isClientLeaveData(data)) return
                server.onNetClientLeave(connection, data)
            } else if (type == 'ping1') {
                if (!callback) return
                callback(Date.now())
            }
        }
        const middleware = new PacketMiddleware(buf => connection.transport.send(buf), onData)

        const transport = createNetTransport({
            onReceive: data => middleware.receive(data),
            onBytesReceived: bytes => connection.onBytesReceived(bytes),
            onBytesSent: bytes => connection.onBytesSent(bytes),
            onClose: () => {
                this.connections.erase(connection)

                if (multi.server != server || server.destroyed) return

                server.onNetClientLeave(connection)
            },
        })
        const connection = new NetConnection(middleware, transport)
        this.connections.push(connection)
    }

    async stop() {
        process.off('exit', this.stopFunc)

        for (const connection of this.connections) {
            connection.close()
        }
        this.connections = []
        await this.transportServer.stop()
    }

    destroy() {
        this.stop()
        window.removeEventListener('beforeunload', this.stopFunc)
    }
}
