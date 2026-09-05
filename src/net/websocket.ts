import type { Server as HttpServer } from 'http'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server-types'
import type { NetTransportClient } from './net-manager-remote'
import type { NetTransport, NetTransportListenerFunctions } from './net-transport'
import type { NetTransportServer } from './net-manager-physics'
import type { WebSocket as WebSocketNode, WebSocketServer } from 'ws'
import { assert } from '../misc/assert'
import type { TLSSocket } from 'tls'

function getWebsocketUrl(connection: RemoteServerConnectionSettings) {
    return `ws${connection.https ? 's' : ''}://${connection.host}:${connection.port}`
}

export interface WsNetTransportServerSettings {}

interface SessionObject {
    socket: WebSocketNode
    transport: WsNetTransport
}

function getRawSocket(ws: WebSocketNode | WebSocket): TLSSocket | undefined {
    if ('_socket' in ws && ws._socket) {
        const rawSocket = ws._socket as TLSSocket | undefined
        return rawSocket
    }
    return
}

export class WsNetTransportServer implements NetTransportServer {
    private wss!: WebSocketServer
    private sessions: SessionObject[] = []

    private async getWs(): Promise<typeof import('ws')> {
        if (window.crossnode) {
            assert(CROSSNODE)
            return (0, eval)(`require('ws')`)
        } else {
            assert(!CROSSNODE)
            assert(PHYSICSNET)
            return PHYSICSNET && (await import('ws'))
        }
    }

    async start(
        httpServer: HttpServer,
        onConnection: (createNetTransport: (listeners: NetTransportListenerFunctions) => NetTransport) => void
    ): Promise<void> {
        assert(PHYSICSNET)

        const { WebSocketServer } = await this.getWs()

        this.wss = new WebSocketServer({ server: httpServer })

        this.wss.on('connection', ws => {
            getRawSocket(ws)?.setNoDelay(true)

            const sessionObject: SessionObject = { socket: ws, transport: undefined as any }
            this.sessions.push(sessionObject)

            onConnection(listeners => {
                const transport = new WsNetTransport(listeners, ws)
                sessionObject.transport = transport
                return transport
            })
        })
    }

    async stop(): Promise<void> {
        this.wss?.close()
        this.sessions = []
    }
}

export interface WsNetTransportClientSettings {}

export class WsNetTransportClient implements NetTransportClient {
    private ws!: WebSocket

    createNetTransport(listeners: NetTransportListenerFunctions): NetTransport {
        return new WsNetTransport(listeners, this.ws)
    }

    async connect(connectionSettings: RemoteServerConnectionSettings) {
        const url = getWebsocketUrl(connectionSettings)
        this.ws = new WebSocket(url)
        this.ws.binaryType = 'arraybuffer'

        return new Promise<void>((resolve, reject) => {
            this.ws.addEventListener('open', () => resolve())
            this.ws.addEventListener('error', (e: Event) => {
                console.error('[ws] WebSocket error:', e)
                reject(new Error('WebSocket connection failed'))
            })
        })
    }
}

export class WsNetTransport implements NetTransport {
    private closed = false

    constructor(
        private listeners: NetTransportListenerFunctions,
        private ws: WebSocketNode | WebSocket
    ) {
        if ('on' in ws) {
            ws.on('message', (data: Buffer) => this.handleRawMessage(new Uint8Array(data)))
            ws.on('close', () => listeners.onClose('disconnect'))
        } else if ('addEventListener' in ws) {
            ws.binaryType = 'arraybuffer'
            ws.addEventListener('message', event => this.handleRawMessage(new Uint8Array(event.data as ArrayBuffer)))
            ws.addEventListener('close', () => listeners.onClose('disconnect'))
        } else assert(false)
    }

    private handleRawMessage(buf: Uint8Array<ArrayBuffer>) {
        if (this.closed) return
        this.listeners.onBytesReceived(buf.byteLength)
        this.listeners.onReceive(buf)
    }

    isConnected() {
        return !this.closed && this.ws.readyState === this.ws.OPEN
    }

    send(data: Uint8Array<ArrayBuffer>) {
        if (this.closed) return
        this.listeners.onBytesSent(data.byteLength)
        this.ws.send(data)
    }

    close(): void {
        if (this.closed) return
        this.closed = true
        try {
            this.ws?.close()
        } catch (e) {
            console.warn('[ws] error closing WebSocket:', e)
        }
    }

    getStatusInfo(): string {
        if (!this.isConnected()) return `websocket disconnected`
        return `websocket`
    }

    getConnectionInfo(): string {
        return getRawSocket(this.ws)?.remoteAddress ?? 'unknown'
    }
}
