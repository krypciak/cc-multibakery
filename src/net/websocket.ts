import type { Server as HttpServer } from 'http'
import type { RemoteServerConnectionSettings } from '../server/remote/remote-server'
import type { NetServerInfoPhysics } from '../client/menu/server-info'
import type { NetTransportClient } from './net-manager-remote'
import type { NetTransport, NetTransportListenerFunctions } from './net-transport'
import type { NetTransportServer } from './net-manager-physics'
import { WebsocketPacketEncoderDecoder } from './binary/websocket-packet-encoder-decoder.generated'
import type { WebSocket as WebSocketNode, WebSocketServer } from 'ws'
import { getServerUrl } from './web-server'
import { assert } from '../misc/assert'
import type { RecordSize, u24, u8 } from 'ts-binarifier/src/type-aliases'

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

export class WsNetTransportServer implements NetTransportServer {
    private wss!: WebSocketServer
    private sessions = new Map<string, { transport: WsNetTransport }>()

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
        netInfo: NetServerInfoPhysics,
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

            onConnection(listeners => {
                const transport = new WsNetTransport(listeners, ws)
                this.sessions.set(sid, { transport })
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
        this.setupMessageHandler()
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

    private setupMessageHandler() {
        if ('on' in this.ws) {
            this.ws.on('message', (data: Buffer) => this.handleRawMessage(new Uint8Array(data)))
            this.ws.on('close', () => this.listeners.onClose())
        } else if ('addEventListener' in this.ws) {
            this.ws.binaryType = 'arraybuffer'
            this.ws.addEventListener('message', (event: MessageEvent) =>
                this.handleRawMessage(new Uint8Array(event.data as ArrayBuffer))
            )
            this.ws.addEventListener('close', () => this.listeners.onClose())
        } else assert(false)
    }

    isConnected() {
        return !this.closed && this.ws.readyState === this.ws.OPEN
    }

    send(data: unknown) {
        if (this.closed) {
            console.warn('[ws] send on closed transport')
            return
        }
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

    getInfo() {
        if (!this.isConnected()) return `websocket disconnected`
        return `websocket`
    }
}
