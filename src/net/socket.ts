import type { Server as _Server, Socket as _Socket } from 'socket.io'
import type * as ioclient from 'socket.io-client'
import { assert } from '../misc/assert'
import { type ClientLeaveData } from '../server/remote/remote-server'
import type { Server as HttpServer } from 'http'
import { type ClientJoinAckData, type ClientJoinData } from '../server/server'
import { getServerUrl } from './web-server'
import { parser as binaryParser } from './socket-io-parser'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import { Opts } from '../options'
import { PacketMiddleware } from './packet'
import { NetManagerRemoteServer } from './net-manager-remote'
import { NetConnection } from './net-connection'
import { NetManagerPhysicsServer } from './net-manager-physics'

type SocketData = never

interface ClientToServerEvents {
    update(data: unknown): void
    join(data: ClientJoinData, callback: (data: ClientJoinAckData) => void): void
    ready(): void
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

export class SocketNetManagerPhysicsServer extends NetManagerPhysicsServer {
    io!: SocketServer

    constructor(netInfo: NetServerInfoPhysics, httpServer: HttpServer) {
        super(netInfo, httpServer)
        setIntervalWorkaround()
    }

    protected async startServer(): Promise<void> {
        assert(PHYSICSNET)
        const { Server } = PHYSICSNET && (await import('socket.io'))
        this.io = new Server(this.httpServer, {
            connectionStateRecovery: {},
            cors: {
                origin: `*`,
            },
            parser: this.netInfo.details.forceJsonCommunication ? undefined : binaryParser,
            pingInterval: this.netInfo.connection.pingInterval ?? Opts.flatOpts.serverPingInterval.init,
            pingTimeout: this.netInfo.connection.pingTimeout ?? Opts.flatOpts.serverPingTimeout.init,
        })

        this.io.on('connection', async socket => {
            this.registerEvents(
                (middleware, onDisconnect) => new SocketNetConnection(middleware, socket, onDisconnect)
            )
        })
    }

    protected async stopConnector(): Promise<void> {
        await this.io.close()
    }
}

export class SocketNetManagerRemoteServer extends NetManagerRemoteServer {
    private socket!: ClientSocket

    protected createNetConnection(middleware: PacketMiddleware): NetConnection {
        return new SocketNetConnection(middleware, this.socket)
    }

    private async getIoClient(): Promise<typeof import('socket.io-client')> {
        if ('io' in window) {
            // @ts-expect-error
            return window.io
        } else if (ig.platform == ig.PLATFORM_TYPES.DESKTOP) {
            assert(!BROWSER)
            assert(REMOTE)
            return REMOTE && !BROWSER && (await import('socket.io-client'))
        } else assert(false, 'Unsupported platform')
    }

    protected async connect() {
        const ioclient = await this.getIoClient()

        this.socket = ioclient.io(getServerUrl(this.connectionSettings), {
            secure: this.connectionSettings.https,
            rejectUnauthorized: false,
            parser: this.connectionSettings.forceJsonCommunication ? undefined : binaryParser,
        }) as ClientSocket

        this.socket.on('disconnect', () => this.onDisconnect())
        this.socket.on('connect_error', error => {
            if (!this.socket.active) console.log(error.message)
        })

        return new Promise<void>(resolve => this.socket.on('connect', resolve))
    }
}

export class SocketNetConnection extends NetConnection {
    private socket: ClientSocket | Socket

    constructor(middleware: PacketMiddleware, socket: ClientSocket | Socket, onDisconnect?: () => void) {
        super(middleware, onDisconnect)
        this.socket = socket

        socket.on('disconnect', () => {
            this.close()
        })
        socket.on('update', data => middleware.receive(data))

        function bytesFromData(data: any): bigint {
            if (multi.server?.measureTraffic && data) {
                return BigInt(new Blob([data]).size)
            }
            return 0n
        }

        // @ts-expect-error
        const engine: Socket = 'conn' in socket ? socket.conn : socket.io.engine

        engine.on('packetCreate', packet => this.onBytesSent(bytesFromData(packet.data)))
        engine.on('packet', packet => this.onBytesReceived(bytesFromData(packet.data)))
    }

    isConnected() {
        return this.socket.connected
    }

    send(data: unknown) {
        this.socket.emit('update', data)
    }

    protected closeConnector(): void {
        if (!this.socket.disconnected) this.socket.disconnect()
        // @ts-expect-error idk
        this.socket.removeAllListeners()
    }

    getConnectionInfo() {
        if (!this.socket.connected) return `socket disconnected`
        // @ts-expect-error
        const type = this.socket.io.engine.transport.name
        return `socket ${type}`
    }
}
