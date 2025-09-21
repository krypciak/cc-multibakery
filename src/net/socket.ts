import type { Server as _Server, Socket as _Socket } from 'socket.io'
import type * as ioclient from 'socket.io-client'
import { assert } from '../misc/assert'
import { NetConnection, NetManagerPhysicsServer } from './connection'
import { PhysicsServer } from '../server/physics/physics-server'
import {
    ClientLeaveData,
    isClientLeaveData,
    RemoteServer,
    RemoteServerConnectionSettings,
} from '../server/remote/remote-server'
import { Client } from '../client/client'
import type { Server as HttpServer } from 'http'
import { ClientJoinAckData, ClientJoinData, isClientJoinData } from '../server/server'
import { getServerUrl } from './web-server'
import { parser } from './socket-io-parser'

type SocketData = never

interface ClientToServerEvents {
    update(data: unknown): void
    join(data: ClientJoinData, callback: (data: ClientJoinAckData) => void): void
    ping1(callback: (date: number) => void): void
    leave(data: ClientLeaveData): void
}
export interface ServerToClientEvents {
    update(data: unknown): void
}
type InterServerEvents = {}
type Socket = _Socket //<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type SocketServer = _Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type ClientSocket = ioclient.Socket //<ServerToClientEvents, ClientToServerEvents>

function setIntervalWorkaround() {
    const origSetInterval = window.setInterval
    window.setInterval = function (...args: Parameters<typeof origSetInterval>) {
        const id = origSetInterval(...args)
        return { unref: () => {}, ref: () => {}, id }
    } as typeof window.setInterval

    const origClearInterval = window.clearInterval
    window.clearInterval = id => {
        if (id === undefined || id === null) return
        if (typeof id === 'number' || typeof id === 'string') {
            origClearInterval(id)
        } else {
            origClearInterval((id as any).id)
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
        if (!PHYSICSNET) return
        process.on('exit', () => this.stop())
        window.addEventListener('beforeunload', () => this.stop())

        const { Server } = PHYSICSNET && (await import('socket.io'))
        this.io = new Server(this.httpServer, {
            connectionStateRecovery: {},
            cors: {
                origin: `*`,
            },
            parser,
        })

        const server = multi.server
        assert(server instanceof PhysicsServer)
        this.io.on('connection', async socket => {
            const connection = new SocketNetConnection(socket, () => {
                this.connections.erase(connection)

                if (!multi.server || multi.server != server || server.destroyed) return

                server.onNetClientLeave(connection)
            })
            this.connections.push(connection)

            socket.on('update', data => server.onNetReceiveUpdate(connection, data))
            socket.on('join', async (data, callback) => {
                if (!isClientJoinData(data)) return callback({ status: 'invalid_join_data' })
                const { client, ackData } = await server.tryJoinClient(data, true)
                if (ackData.status == 'ok') connection.join(client!)
                callback(ackData)
            })
            socket.on('leave', data => {
                if (!isClientLeaveData(data)) return
                server.onNetClientLeave(connection, data)
            })
            socket.on('ping1', callback => {
                callback(Date.now())
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
    timeOffset: number = 0

    private joinActCallbacks: Record<string, (data: ClientJoinAckData) => void> = {}

    constructor(public connectionSettings: RemoteServerConnectionSettings) {}

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

        const socket = ioclient.io(getServerUrl(this.connectionSettings), {
            secure: this.connectionSettings.https,
            rejectUnauthorized: false,
            parser,
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

                this.measureClockOffset()

                resolve()
            })
        })
    }

    private async probeTimeOffset(): Promise<{ timeTook: number; timeDiff: number }> {
        assert(this.conn)
        const clientDate = Date.now()
        const clientTimeStart = performance.now()
        const serverDate: number = await this.conn.socket.emitWithAck('ping1')
        const clientTimeEnd = performance.now()

        const timeTook = clientTimeEnd - clientTimeStart

        return { timeTook, timeDiff: serverDate - clientDate }
    }

    private async measureClockOffset() {
        if (!Opts.serverTimeSynchronization) return

        const probeFor = 1e3
        const start = performance.now()

        let minTimeTook = 100000
        let minRawDiff = 100000

        while (true) {
            if (!this.conn || this.conn.closed) return

            const { timeTook, timeDiff: rawDiff } = await this.probeTimeOffset()
            minTimeTook = Math.min(minTimeTook, timeTook)
            minRawDiff = Math.min(minRawDiff, rawDiff)
            this.timeOffset = minRawDiff - minTimeTook / 2

            if (performance.now() - start >= probeFor) break
        }
    }

    calculatePing(serverTime: number): number {
        return Date.now() - serverTime + this.timeOffset
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

    async sendLeave(data: ClientLeaveData): Promise<void> {
        assert(this.conn)
        assert(multi.server instanceof RemoteServer)
        this.conn.socket.emit('leave', data)
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

        // @ts-expect-error
        const engine: Socket = 'conn' in socket ? socket.conn : socket.io.engine

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
