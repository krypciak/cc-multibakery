import type { Client } from '../client/client'
import type { NetTransport } from './net-transport'
import { PacketMiddleware } from './packet'

export class NetConnection {
    clients: Client[] = []
    closed: boolean = false
    readyForSendingUpdate: boolean = false

    bytesSent: bigint = 0n
    bytesReceived: bigint = 0n

    constructor(
        public middleware: PacketMiddleware,
        public transport: NetTransport
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

        for (const client of this.clients) {
            this.leave(client)
        }
    }
}
