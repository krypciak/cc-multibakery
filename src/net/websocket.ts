import type { Server as HttpServer } from 'http'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server-types'
import type { NetTransportClient } from './net-manager-remote'
import type { NetTransport, NetTransportListenerFunctions } from './net-transport'
import type { NetTransportServer } from './net-manager-physics'
import { WebsocketPacketEncoderDecoder } from './binary/websocket-packet-encoder-decoder.generated'
import type { WebSocket as WebSocketNode, WebSocketServer } from 'ws'
import { getServerUrl } from './web-server-utils'
import { assert } from '../misc/assert'
import type { RecordSize, u24, u8 } from 'ts-binarifier/src/type-aliases'
import type { TLSSocket } from 'tls'

enum PacketType {
    CONNECT,
    DISCONNECT,
    EVENT,
    CONNECT_ERROR,
}

interface WsPacket {
    type: PacketType
    sid?: string
    binData?: u8[] & RecordSize<u24>
    jsonData?: any
}
export type GenerateType = WsPacket

export interface WsNetTransportServerSettings {}

interface SessionObject {
    socket: WebSocketNode
    transport: WsNetTransport
}

export class WsNetTransportServer implements NetTransportServer {
    private wss!: WebSocketServer
    private sessions = new Map<string, SessionObject>()

    private sessionIdCounter = 0
    private generateSessionId(): string {
        return `${Date.now().toString(36)}-${(this.sessionIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

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
            const sid = this.generateSessionId()

            const connectPacket = WebsocketPacketEncoderDecoder.encode({ type: PacketType.CONNECT, sid })
            ws.send(connectPacket)

            const sessionObject: SessionObject = { socket: ws, transport: undefined as any }
            this.sessions.set(sid, sessionObject)

            onConnection(listeners => {
                const transport = new WsNetTransport(listeners, ws)
                sessionObject.transport = transport
                return transport
            })
        })
    }

    async stop(): Promise<void> {
        this.wss?.close()
        this.sessions.clear()
    }
}

export interface WsNetTransportClientSettings {}

export class WsNetTransportClient implements NetTransportClient {
    private ws!: WebSocket
    private sid!: string

    createNetTransport(listeners: NetTransportListenerFunctions): NetTransport {
        return new WsNetTransport(listeners, this.ws)
    }

    async connect(connectionSettings: RemoteServerConnectionSettings) {
        const url = getServerUrl(connectionSettings)
        this.ws = new WebSocket(url)
        this.ws.binaryType = 'arraybuffer'

        return new Promise<void>((resolve, reject) => {
            this.ws.addEventListener('open', () => {
                const onConnectMessage = (event: MessageEvent) => {
                    const buf = new Uint8Array(event.data as ArrayBuffer)
                    const packet = WebsocketPacketEncoderDecoder.decode(buf)
                    assert(packet.type === PacketType.CONNECT && packet.sid)

                    this.sid = packet.sid
                    this.ws.removeEventListener('message', onConnectMessage)
                    resolve()
                }
                this.ws.addEventListener('message', onConnectMessage)
            })

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

    private handleRawMessage(buf: Uint8Array) {
        if (this.closed) return
        this.listeners.onBytesReceived(BigInt(buf.byteLength))

        const packet = WebsocketPacketEncoderDecoder.decode(buf)
        if (packet.type === PacketType.EVENT) {
            if (packet.binData) {
                this.listeners.onReceive(new Uint8Array(packet.binData))
            } else if (packet.jsonData) {
                this.listeners.onReceive(packet.jsonData)
            }
        } else {
            console.warn('[ws] unexpected packet type in transport:', PacketType[packet.type])
        }
    }

    isConnected() {
        return !this.closed && this.ws.readyState === this.ws.OPEN
    }

    send(data: unknown) {
        if (this.closed) return
        const encoded = WebsocketPacketEncoderDecoder.encode({ type: PacketType.EVENT, binData: data as any })
        this.listeners.onBytesSent(BigInt(encoded.byteLength))
        this.ws.send(encoded)
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
        if ('_socket' in this.ws) {
            const rawSocket = this.ws._socket as TLSSocket
            return rawSocket.remoteAddress ?? 'unknown'
        } else {
            return this.ws.url ?? 'unknown'
        }
    }
}
