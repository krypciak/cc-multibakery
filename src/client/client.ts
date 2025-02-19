export interface ClientSettings {
    username: string
    globalTps: number
}

export interface Client<T extends ClientSettings = ClientSettings> {
    // player: Player
    s: T

    // notifyJoin(server: ClientJoinResponse): Promise<void>
    // update(packet: FromClientUpdatePacket): void
}
