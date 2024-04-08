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

export interface UpdateInput {
    isUsingMouse: boolean
    isUsingKeyboard: boolean
    isUsingAccelerometer: boolean
    ignoreKeyboard: boolean
    mouseGuiActive: boolean
    mouse: Vec2
    accel: Vec3
    presses: ig.Input['presses']
    keyups: ig.Input['keyups']
    locks: ig.Input['locks']
    delayedKeyup: ig.Input['delayedKeyup']
    currentDevice: ig.Input['currentDevice']
    actions: ig.Input['actions']
}

export interface FromClientUpdatePacket {
    vars?: FromClientUpdatePacket.Var[]
    input?: UpdateInput
    gatherInput?: ig.ENTITY.Player.PlayerInput
    relativeCursorPos?: Vec2
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
    pos?: Vec3
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
    rollback: boolean
    clientStateCorrection?: {
        posTickInterval?: number
    }
}
