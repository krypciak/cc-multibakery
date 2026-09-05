import type { Client } from '../client/client'
import type { NetTransport } from './net-transport'
import { PacketWrapper } from './packet'

export class NetConnection {
    clients: Client[] = []
    closed: boolean = false
    readyForSendingUpdate: boolean = false

    bytesSent: number = 0
    bytesReceived: number = 0

    constructor(
        public wrapper: PacketWrapper,
        public transport: NetTransport
    ) {}

    join(client: Client) {
        this.clients.push(client)
    }
    leave(client: Client) {
        this.clients.erase(client)
    }

    onBytesSent(bytes: number) {
        this.bytesSent += bytes
    }
    onBytesReceived(bytes: number) {
        this.bytesReceived += bytes
    }

    close(): void {
        if (this.closed) return
        this.closed = true

        this.transport.close()

        for (const client of this.clients) {
            this.leave(client)
        }
        this.wrapper.destroy()
    }
}
