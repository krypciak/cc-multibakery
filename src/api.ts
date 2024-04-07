export interface ServerToClientEvents {}

export type PlayerJoinResponse =
    | {
          usernameTaken: true
      }
    | {
          usernameTaken?: false
          mapName: string
      }

export interface ClientToServerEvents {
    getPlayerUsernames(callback: (usernames: string[]) => void): void
    join(username: string, callback: (resp: PlayerJoinResponse) => void): void
    leave(): void
}

export interface InterServerEvents {}
