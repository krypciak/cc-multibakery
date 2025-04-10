export interface NetConnection {
    instanceId: number
    onReceive?: (conn: NetConnection, data: unknown) => void
    onClose?: (conn: NetConnection) => void

    isConnected(): boolean
    send(data: unknown): void
    close(): void
}
export interface NetManagerLocalServer {
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
