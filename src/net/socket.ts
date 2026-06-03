import type { Server as SocketServer, Socket } from 'socket.io'
import type { Socket as ClientSocket } from 'socket.io-client'
import type { Server as HttpServer } from 'http'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import type { NetTransportClient } from './net-manager-remote'
import type { NetTransport, NetTransportListenerFunctions } from './net-connection'
import type { NetTransportServer } from './net-manager-physics'
import { Opts } from '../options'
import { getServerUrl } from './web-server'
import { parser as binaryParser } from './socket-io-parser'
import { assert } from '../misc/assert'

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

export class SocketNetTransportServer implements NetTransportServer {
    private io!: SocketServer

    async start(
        netInfo: NetServerInfoPhysics,
        httpServer: HttpServer,
        onConnection: (createNetTransport: (listeners: NetTransportListenerFunctions) => NetTransport) => void
    ): Promise<void> {
        assert(PHYSICSNET)

        setIntervalWorkaround()

        const { Server } = PHYSICSNET && (await import('socket.io'))
        this.io = new Server(httpServer, {
            connectionStateRecovery: {},
            cors: {
                origin: `*`,
            },
            parser: netInfo.details.forceJsonCommunication ? undefined : binaryParser,
            pingInterval: netInfo.connection.pingInterval ?? Opts.flatOpts.serverPingInterval.init,
            pingTimeout: netInfo.connection.pingTimeout ?? Opts.flatOpts.serverPingTimeout.init,
        })

        this.io.on('connection', async socket => {
            onConnection(listeners => new SocketNetTransport(listeners, socket))
        })
    }

    async stop(): Promise<void> {
        await this.io.close()
    }
}

export class SocketNetTransportClient implements NetTransportClient {
    private socket!: ClientSocket

    createNetTransport(listeners: NetTransportListenerFunctions): NetTransport {
        return new SocketNetTransport(listeners, this.socket)
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

    async connect(connectionSettings: RemoteServerConnectionSettings, onDisconnect: () => void) {
        assert(connectionSettings.type == 'socket')

        const { io } = await this.getIoClient()

        const url = getServerUrl(connectionSettings)
        this.socket = io(url, {
            secure: connectionSettings.https,
            rejectUnauthorized: false,
            parser: connectionSettings.forceJsonCommunication ? undefined : binaryParser,
        }) as ClientSocket

        this.socket.on('disconnect', () => onDisconnect())
        this.socket.on('connect_error', error => {
            if (!this.socket.active) console.log(error.message)
        })

        return new Promise<void>(resolve => this.socket.on('connect', resolve))
    }
}

export class SocketNetTransport implements NetTransport {
    constructor(
        listeners: NetTransportListenerFunctions,
        private socket: ClientSocket | Socket
    ) {
        socket.on('disconnect', () => this.close())
        socket.on('update', data => listeners.onReceive(data))

        function bytesFromData(data: any): bigint {
            if (multi.server?.measureTraffic && data) {
                return BigInt(new Blob([data]).size)
            }
            return 0n
        }

        // @ts-expect-error
        const engine: Socket = 'conn' in socket ? socket.conn : socket.io.engine

        engine.on('packetCreate', packet => listeners.onBytesSent(bytesFromData(packet.data)))
        engine.on('packet', packet => listeners.onBytesReceived(bytesFromData(packet.data)))
    }

    isConnected() {
        return this.socket.connected
    }

    send(data: unknown) {
        this.socket.emit('update', data)
    }

    close(): void {
        if (!this.socket.disconnected) this.socket.disconnect()
        // @ts-expect-error idk
        this.socket.removeAllListeners()
    }

    getInfo() {
        if (!this.socket.connected) return `socket disconnected`
        // @ts-expect-error
        const type = this.socket.io.engine.transport.name
        return `socket ${type}`
    }
}
