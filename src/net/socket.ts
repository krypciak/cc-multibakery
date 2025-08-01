import type { Server as _Server, Socket as _Socket } from 'socket.io'
import type * as ioclient from 'socket.io-client'
import { assert } from '../misc/assert'
import { NetConnection, NetManagerPhysicsServer } from './connection'
import { PhysicsServer } from '../server/physics/physics-server'
import { RemoteServer } from '../server/remote/remote-server'
import { Client } from '../client/client'
import type { Server as HttpServer } from 'http'
import { ClientJoinAckData, ClientJoinData, isClientJoinData } from '../server/server'

type SocketData = never

type ClientToServerEvents = {
    update(data: unknown): void
    join(data: ClientJoinData, callback: (data: ClientJoinAckData) => void): void
}
type ServerToClientEvents = {
    update(data: unknown): void
    error(msg: string): void
}
type InterServerEvents = {}
type Socket = _Socket //<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type SocketServer = _Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type ClientSocket = ioclient.Socket //<ServerToClientEvents, ClientToServerEvents>

function setIntervalWorkaround() {
    const origSetInterval = window.setInterval
    // @ts-expect-error
    window.setInterval = (...args) => {
        const id = origSetInterval(...args)
        return { unref: () => {}, ref: () => {}, id }
    }

    const origClearInterval = window.clearInterval
    window.clearInterval = id => {
        if (id === undefined || id === null) return
        if (typeof id === 'number') {
            origClearInterval(id)
        } else {
            origClearInterval(id.id)
        }
    }
}

export class SocketNetManagerPhysicsServer implements NetManagerPhysicsServer {
    connections: SocketNetConnection[] = []
    io!: SocketServer

    constructor(private httpServer: HttpServer) {
        setIntervalWorkaround()
    }

    async start() {
        assert(PHYSICS)
        assert(PHYSICSNET)
        if (!PHYSICS || !PHYSICSNET) return
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        const { Server } = PHYSICS && PHYSICSNET && (await import('socket.io'))
        this.io = new Server(this.httpServer, {
            connectionStateRecovery: {},
            cors: {
                origin: `*`,
            },
        })

        const server = multi.server
        assert(server instanceof PhysicsServer)
        this.io.on('connection', async socket => {
            const connection = new SocketNetConnection(socket, () => {
                this.connections.erase(connection)

                if (!multi.server || multi.server != server || server.destroyed) return

                server.onNetDisconnect(connection)
            })
            this.connections.push(connection)

            socket.on('update', data => server.onNetReceive(connection, data))
            socket.on('join', async (data, callback) => {
                if (!isClientJoinData(data)) return callback({ status: 'invalid_join_data' })
                const { client, ackData } = await server.tryJoinClient(data, true)
                if (ackData.status == 'ok') connection.join(client!)
                callback(ackData)
            })
        })
    }

    async stop() {
        for (const connection of this.connections) {
            connection.close()
        }
        this.connections = []
        await this.io.close()
    }

    destroy() {
        this.stop()
    }
}

export class SocketNetManagerRemoteServer {
    conn?: SocketNetConnection

    private joinActCallbacks: Record<string, (data: ClientJoinAckData) => void> = {}

    constructor(
        public host: string,
        public port: number
    ) {}

    async connect() {
        assert(REMOTE)
        if (!REMOTE) return

        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        const server = multi.server
        assert(server instanceof RemoteServer)

        let ioclient: typeof import('socket.io-client')
        if ('io' in window) {
            // @ts-expect-error
            ioclient = window.io
        } else if (ig.platform == ig.PLATFORM_TYPES.DESKTOP) {
            assert(!BROWSER)
            ioclient = REMOTE && !BROWSER && (await import('socket.io-client'))
        } else assert(false, 'Unsupported platform')

        const socket = ioclient.io(`https://${this.host}:${this.port}`, {
            secure: true,
            rejectUnauthorized: false,
        }) as ClientSocket
        socket.on('update', data => server.onNetReceive(this.conn!, data))
        socket.on('disconnect', () => {
            this.stop()
            if (!multi.server || multi.server != server || server.destroyed) return

            server.onNetDisconnect()
        })
        return new Promise<void>(resolve => {
            socket.on('connect', () => {
                const conn = new SocketNetConnection(socket)
                this.conn = conn

                resolve()
            })
        })
    }

    async sendJoin(data: ClientJoinData): Promise<ClientJoinAckData> {
        const ack = await new Promise<ClientJoinAckData>(resolve => {
            assert(this.conn)
            assert(multi.server instanceof RemoteServer)
            this.joinActCallbacks[data.username] = resolve
            this.conn.socket.emit('join', data, resolve)
        })
        return ack
    }

    stop() {
        this.conn?.close()
    }

    destroy() {
        this.stop()
    }
}

export class SocketNetConnection implements NetConnection {
    clients: Client[] = []
    closed: boolean = false

    bytesSent: bigint = 0n
    bytesReceived: bigint = 0n

    constructor(
        public socket: ClientSocket | Socket,
        public onDisconnect?: () => void
    ) {
        socket.on('disconnect', () => {
            this.close()
            // this.onDisconnect?.()
        })

        function bytesFromData(data: any): bigint {
            if (multi.server?.measureTraffic && data) {
                return BigInt(new Blob([data]).size)
            }
            return 0n
        }

        const engine = 'conn' in socket ? socket.conn : socket.io.engine
        engine.on('packetCreate', packet => {
            this.bytesSent += bytesFromData(packet.data)
        })
        engine.on('packet', packet => {
            this.bytesReceived += bytesFromData(packet.data)
        })
    }

    join(client: Client) {
        this.clients.push(client)
    }
    leave(client: Client) {
        this.clients.erase(client)
    }

    isConnected() {
        return this.socket.connected
    }

    send(type: string, data: unknown) {
        this.socket.emit(type, data)
    }

    close(): void {
        if (this.closed) return
        this.closed = true
        if (!this.socket.disconnected) this.socket.disconnect()

        this.onDisconnect?.()

        for (const client of this.clients) {
            this.leave(client)
        }
    }

    getConnectionInfo() {
        if (!this.socket.connected) return `socket disconnected`
        // @ts-expect-error
        const type = this.socket.io.engine.transport.name
        return `socket ${type}`
    }
}
