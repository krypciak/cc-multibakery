import { assert } from '../misc/assert'
import { isClientLeaveData } from '../server/remote/remote-server'
import type { Server as HttpServer } from 'http'
import { isClientJoinData } from '../server/server'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import { assertPhysics } from '../server/physics/is-physics-server'
import { PacketMiddleware, type PacketEventType } from './packet'
import { NetConnection } from './net-connection'

export abstract class NetManagerPhysicsServer {
    private stopFunc = () => this.stop()

    connections: NetConnection[] = []

    constructor(
        protected netInfo: NetServerInfoPhysics,
        protected httpServer: HttpServer
    ) {
        assert(httpServer)
    }

    protected abstract startServer(): Promise<void>

    async start() {
        assert(PHYSICS)
        assert(PHYSICSNET)
        if (!PHYSICSNET) return
        process.on('exit', this.stopFunc)
        window.addEventListener('beforeunload', this.stopFunc)

        await this.startServer()
    }

    protected async registerEvents(
        createNetConnection: (middleware: PacketMiddleware, onDisconnect: () => void) => NetConnection
    ) {
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
                connection.ready = true
            } else if (type == 'leave') {
                if (!isClientLeaveData(data)) return
                server.onNetClientLeave(connection, data)
            } else if (type == 'ping1') {
                if (!callback) return
                callback(Date.now())
            }
        }
        const middleware = new PacketMiddleware(buf => connection.send(buf), onData)

        const connection = createNetConnection(middleware, () => {
            this.connections.erase(connection)

            if (multi.server != server || server.destroyed) return

            server.onNetClientLeave(connection)
        })
        this.connections.push(connection)
    }

    protected abstract stopConnector(): Promise<void>

    async stop() {
        process.off('exit', this.stopFunc)

        for (const connection of this.connections) {
            connection.close()
        }
        this.connections = []
        await this.stopConnector()
    }

    destroy() {
        this.stop()
        window.removeEventListener('beforeunload', this.stopFunc)
    }
}
