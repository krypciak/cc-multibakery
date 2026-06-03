import type { Client } from '../client/client'
import { PacketMiddleware } from './packet'

export interface NetTransportListenerFunctions {
    onReceive(data: Uint8Array): void
    onBytesSent(bytes: bigint): void
    onBytesReceived(bytes: bigint): void
}
export interface NetTransport {
    send(data: unknown): void
    close(): void
    isConnected(): boolean
    getInfo(): string
}

export class NetConnection {
    clients: Client[] = []
    closed: boolean = false
    readyForSendingUpdate: boolean = false

    bytesSent: bigint = 0n
    bytesReceived: bigint = 0n

    constructor(
        public middleware: PacketMiddleware,
        public transport: NetTransport,
        private onDisconnect?: () => void
    ) {}

    join(client: Client) {
        this.clients.push(client)
    }
    leave(client: Client) {
        this.clients.erase(client)
    }

    onBytesSent(bytes: bigint) {
        this.bytesSent += bytes
    }
    onBytesReceived(bytes: bigint) {
        this.bytesReceived += bytes
    }

    close(): void {
        if (this.closed) return
        this.closed = true

        this.transport.close()
        this.onDisconnect?.()

        for (const client of this.clients) {
            this.leave(client)
        }
    }
}
