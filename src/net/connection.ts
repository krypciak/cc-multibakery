import { Client } from '../client/client'

export interface NetConnection {
    clients: Client[]
    onReceive?: (data: unknown) => void
    onDisconnect?: () => void

    join(client: Client): void
    leave(client: Client): void
    isConnected(): boolean
    sendUpdate(data: unknown): void
    close(): void
    getConnectionInfo(): string
}
export interface NetManagerPhysicsServer {
    connections: NetConnection[]

    start(): Promise<void>
    stop(): Promise<void>
    destroy(): Promise<void>
}
