// import { EntityStateEntry, EntityStateUpdatePacketRecord } from './state/states'

// import { ServerSettings } from './server/server'

// export type InitialState = {
//     saveData: string
//     packet: ToClientUpdatePacket
// }

// export type ClientJoinResponse =
//     | {
//           usernameTaken: true
//       }
//     | {
//           usernameTaken?: false
//           mapName: string
//           serverSettings: ServerSettings
//           // state: InitialState
//       }

// export namespace FromClientUpdatePacket {
//     export interface Var {
//         path: string
//         value: any
//     }
// }

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
    buttonDeadzones: Record<ig.BUTTONS, number>
    axesDeadzones: Record<ig.BUTTONS, number>
    buttonStates: Record<ig.BUTTONS, boolean>
    axesStates: Record<ig.BUTTONS, number>
    pressedStates: Record<ig.BUTTONS, boolean>
    releasedStates: Record<ig.BUTTONS, boolean>
}

// export type FromClientUpdatePacket = {
//     paused?: boolean
// } & EntityStateEntry<'ig.dummy.DummyPlayer'>

// export interface ClientToServerEvents {
//     getPlayerUsernames(callback: (usernames: string[]) => void): void
//     join(username: string, callback: (resp: ClientJoinResponse) => void): void
//     leave(): void
//     update(packet: FromClientUpdatePacket): void
// }
/* --------- */

// export interface ToClientUpdatePacket {
//     vars?: FromClientUpdatePacket.Var[]
//     // entityStates?: EntityStateUpdatePacketRecord
//     playersLeft?: string[]
// }
// export interface ServerToClientEvents {
//     update(packet: ToClientUpdatePacket): void
// }
/* --------- */
// export interface InterServerEvents {}
