import type { Server as SocketServer, Socket } from 'socket.io'
import type { Socket as ClientSocket } from 'socket.io-client'
import type { Server as HttpServer } from 'http'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import type { NetTransportClient } from './net-manager-remote'
import type { NetTransport, NetTransportListenerFunctions } from './net-transport'
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

export interface SocketIoNetTransportServerSettings {
    disableBinaryParser?: boolean
}

export class SocketIoNetTransportServer implements NetTransportServer {
    private io!: SocketServer

    constructor(private settings: SocketIoNetTransportServerSettings) {}

    async start(
        netInfo: NetServerInfoPhysics,
        httpServer: HttpServer,
        onConnection: (createNetTransport: (listeners: NetTransportListenerFunctions) => NetTransport) => void
    ): Promise<void> {
        assert(PHYSICSNET, 'running socket.io net transport server without PHYSICSNET')
        assert(!!window.crossnode == CROSSNODE, 'running socket.io net transport server with CROSSNODE flag mismatch')

        setIntervalWorkaround()

        const { Server } = PHYSICSNET && (await import('socket.io'))
        this.io = new Server(httpServer, {
            connectionStateRecovery: {},
            cors: {
                origin: `*`,
            },
            parser: this.settings.disableBinaryParser ? undefined : binaryParser,
            pingInterval: netInfo.connection.pingInterval ?? Opts.flatOpts.serverPingInterval.init,
            pingTimeout: netInfo.connection.pingTimeout ?? Opts.flatOpts.serverPingTimeout.init,
        })

        this.io.on('connection', async socket => {
            onConnection(listeners => new SocketIoNetTransport(listeners, socket))
        })
    }

    async stop(): Promise<void> {
        await this.io?.close()
    }
}

export interface SocketIoNetTransportClientSettings {
    disableBinaryParser?: boolean
}

export class SocketIoNetTransportClient implements NetTransportClient {
    private socket!: ClientSocket

    constructor(private settings: SocketIoNetTransportClientSettings) {}

    createNetTransport(listeners: NetTransportListenerFunctions): NetTransport {
        return new SocketIoNetTransport(listeners, this.socket)
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

    async connect(connectionSettings: RemoteServerConnectionSettings) {
        const { io } = await this.getIoClient()

        const url = getServerUrl(connectionSettings)
        this.socket = io(url, {
            secure: true,
            rejectUnauthorized: false,
            parser: this.settings.disableBinaryParser ? undefined : binaryParser,
        }) as ClientSocket

        this.socket.on('connect_error', error => {
            if (!this.socket.active) console.log(error.message)
        })

        return new Promise<void>(resolve => this.socket.on('connect', resolve))
    }
}

export class SocketIoNetTransport implements NetTransport {
    constructor(
        listeners: NetTransportListenerFunctions,
        private socket: ClientSocket | Socket
    ) {
        socket.on('disconnect', () => listeners.onClose())
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
        if (!this.socket) return
        if (!this.socket.disconnected) this.socket.disconnect()
        // @ts-expect-error idk
        this.socket.removeAllListeners()
    }

    getInfo() {
        if (!this.socket.connected) return `socket.io disconnected`
        // @ts-expect-error
        const type = this.socket.io.engine.transport.name
        return `socket.io ${type}`
    }
}
