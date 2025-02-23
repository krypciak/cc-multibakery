export interface ServerSettings {
    name: string
    globalTps: number
    godmode?: boolean
}

export interface Server<T extends ServerSettings = ServerSettings> {
    s: T

    start(): Promise<void>

    // joinClient(client: Client): Promise<ClientJoinResponse>
    // getUsernames(): Promise<string[]>

    update(): void
    deferredUpdate(): void
    // receiveDataFromClient(username: string, packet: FromClientUpdatePacket): void

    destroy(): void
}
