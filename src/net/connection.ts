export interface NetConnection {
    instanceId: number
    onReceive?: (conn: NetConnection, data: unknown) => void
    onClose?: (conn: NetConnection) => void

    isConnected(): boolean
    sendUpdate(data: unknown): void
    close(): void
}
export interface NetManagerPhysicsServer {
    connections: NetConnection[]
    openListeners: ((conn: NetConnection) => void)[]
    closeListeners: ((conn: NetConnection) => void)[]

    start(): Promise<void>
    stop(): Promise<void>
    destroy(): Promise<void>
}

declare global {
    namespace ig {
        var netConnection: NetConnection | undefined
    }
}
