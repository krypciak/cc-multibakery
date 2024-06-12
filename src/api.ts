import { EntityStateEntry, EntityStateUpdatePacketRecord } from './state/states'

export type InitialState = {
    saveData: string
    packet: ToClientUpdatePacket
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
        value: any
    }
}

export interface DummyUpdateInput {
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

export interface DummyUpdateGamepadInput {
    buttonDeadzones: Record<ig.BUTTONS, boolean>
    axesDeadzones: Record<ig.BUTTONS, boolean>
    buttonStates: Record<ig.BUTTONS, boolean>
    axesStates: Record<ig.BUTTONS, boolean>
    pressedStates: Record<ig.BUTTONS, boolean>
    releasedStates: Record<ig.BUTTONS, boolean>
}

export type FromClientUpdatePacket = {
    paused?: boolean
} & EntityStateEntry<'ig.dummy.DummyPlayer'>

export interface ClientToServerEvents {
    getPlayerUsernames(callback: (usernames: string[]) => void): void
    join(username: string, callback: (resp: PlayerJoinResponse) => void): void
    leave(): void
    update(packet: FromClientUpdatePacket): void
}
/* --------- */

export interface ToClientUpdatePacket {
    vars?: FromClientUpdatePacket.Var[]
    entityStates?: EntityStateUpdatePacketRecord
    playersLeft?: string[]
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

export function getDummyUpdateInputFromIgInput(input: ig.Input): DummyUpdateInput {
    return {
        isUsingMouse: input.isUsingMouse,
        isUsingKeyboard: input.isUsingKeyboard,
        isUsingAccelerometer: input.isUsingAccelerometer,
        ignoreKeyboard: input.ignoreKeyboard,
        mouseGuiActive: input.mouseGuiActive,
        mouse: input.mouse,
        accel: input.accel,
        presses: input.presses,
        keyups: input.keyups,
        locks: input.locks,
        delayedKeyup: input.delayedKeyup,
        currentDevice: input.currentDevice,
        actions: input.actions,
    }
}

export function getDummyUpdateGamepadInputFromIgGamepadManager(
    gamepadmanager: ig.GamepadManager
): DummyUpdateGamepadInput | undefined {
    const gp = gamepadmanager.activeGamepads[0]
    if (!gp) return
    return {
        buttonDeadzones: gp.buttonDeadzones,
        axesStates: gp.axesStates,
        buttonStates: gp.buttonStates,
        axesDeadzones: gp.axesDeadzones,
        pressedStates: gp.pressedStates,
        releasedStates: gp.releasedStates,
    }
}
