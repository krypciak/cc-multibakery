export type InitialState = {
    saveData: string
}

export type PlayerJoinResponse =
    | {
          usernameTaken: true
      }
    | {
          usernameTaken?: false
          mapName: string
          serverSettings: ServerSettingsBase
          state: InitialState
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

export type FromClientUpdatePacket = {
    element?: sc.ELEMENT
} & (
    | {
          paused: true
      }
    | {
          paused?: false
          vars?: FromClientUpdatePacket.Var[]
          input?: UpdateInput
          gatherInput?: ig.ENTITY.Player.PlayerInput
          relativeCursorPos?: Vec2
      }
)

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
    godmode?: boolean
    unloadInactiveMapsMs?: number /* set to -1 to diable unloading inactive maps */
}

export function emptyGatherInput(): ig.ENTITY.Player.PlayerInput {
    return {
        thrown: false,
        melee: false,
        aimStart: false,
        aim: false,
        attack: false,
        autoThrow: false,
        charge: false,
        dashX: 0,
        dashY: 0,
        guard: false,
        relativeVel: 0,
        moveDir: Vec2.create(),
        lastMoveDir: Vec2.create(),
        switchMode: false,
        /* charging crashes */
    }
}
