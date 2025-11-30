import type { Client } from '../client/client'

export interface NetConnection {
    clients: Client[]
    bytesSent: bigint
    bytesReceived: bigint
    onReceive?: (data: unknown) => void
    onDisconnect?: () => void

    join(client: Client): void
    leave(client: Client): void
    isConnected(): boolean
    send(type: string, data: unknown): void
    close(): void
    getConnectionInfo(): string
}
export interface NetManagerPhysicsServer {
    connections: NetConnection[]

    start(): Promise<void>
    stop(): void
    destroy(): void
}
