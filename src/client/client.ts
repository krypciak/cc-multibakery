export interface ClientSettings {
    username: string
}

export interface Client<T extends ClientSettings = ClientSettings> {
    s: T

    // notifyJoin(server: ClientJoinResponse): Promise<void>
    // update(packet: FromClientUpdatePacket): void
}
