import type { Client } from '../client/client'
import { PacketMiddleware } from './packet'

export abstract class NetConnection {
    clients: Client[] = []
    closed: boolean = false
    ready: boolean = false

    bytesSent: bigint = 0n
    bytesReceived: bigint = 0n

    constructor(
        public middleware: PacketMiddleware,
        public onDisconnect?: () => void
    ) {}

    join(client: Client) {
        this.clients.push(client)
    }
    leave(client: Client) {
        this.clients.erase(client)
    }

    abstract isConnected(): boolean

    onBytesSent(bytes: bigint) {
        this.bytesSent += bytes
    }
    onBytesReceived(bytes: bigint) {
        this.bytesReceived += bytes
    }

    abstract send(data: unknown): void

    protected abstract closeConnector(): void

    close(): void {
        if (this.closed) return
        this.closed = true

        this.onDisconnect?.()

        for (const client of this.clients) {
            this.leave(client)
        }
    }

    abstract getConnectionInfo(): string
}
