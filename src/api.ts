export type PlayerJoinResponse =
    | {
          usernameTaken: true
      }
    | {
          usernameTaken?: false
          mapName: string
          serverSettings: ServerSettingsBase
      }

export namespace FromClientUpdatePacket {
    export interface Var {
        path: string
        value: any /* possible RCE exploit???? */
    }
}
export interface FromClientUpdatePacket {
    vars?: FromClientUpdatePacket.Var[]
}

export interface ClientToServerEvents {
    getPlayerUsernames(callback: (usernames: string[]) => void): void
    join(username: string, callback: (resp: PlayerJoinResponse) => void): void
    leave(): void
    update(packet: FromClientUpdatePacket): void
}
/* --------- */
export interface ToClientUpdatePacket {
    vars?: FromClientUpdatePacket.Var[]
}
export interface ServerToClientEvents {
    update(packet: ToClientUpdatePacket): void
}
/* --------- */
export interface InterServerEvents {}
/* --------- */
export interface ServerSettingsBase {
    name: string
    globalTps: number
    entityTps: number
    physicsTps: number
    eventTps: number
}
