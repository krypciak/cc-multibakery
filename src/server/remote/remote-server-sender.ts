import {
    disallowedInputActions,
    type GamepadManagerData,
    type InputData,
    isGamepadManagerData,
    isInputData,
} from '../../dummy/dummy-input-puppet'
import { assert } from '../../misc/assert'
import { type MapName, type Username } from '../../net/binary/binary-types'
import { RemoteUpdatePacketEncoderDecoder } from '../../net/binary/remote-update-packet-encoder-decoder.generated'
import { cleanRecord, StateMemory } from '../../state/state-util'
import { RemoteServer } from './remote-server'

declare global {
    namespace ig {
        var remoteSenderStateMemory: StateMemory | undefined
    }
}

const maxInputFieldTextLength = 50

export function sendRemoteServerPacket() {
    assert(multi.server instanceof RemoteServer)
    const conn = multi.server.netManager.conn
    if (!conn) return

    const clientPackets: RemoteServerClientPackets = {}
    for (const client of multi.server.clients.values()) {
        const inst = client.inst
        assert(inst)

        const inPauseScreen = inst.ig.inPauseScreen
        let packet: RemoteServerClientPacket | undefined

        if (!inPauseScreen) {
            const input = inst.ig.input.getInput()
            if (input) {
                for (const action of disallowedInputActions) {
                    delete input.presses?.[action]
                    delete input.actions?.[action]
                }
            }

            const gamepad = inst.ig.gamepad.getInput()

            const memory = StateMemory.get(ig.remoteSenderStateMemory)
            ig.remoteSenderStateMemory ??= memory

            packet = {
                input,
                gamepad,
                inputFieldText: memory.diff(inst.ig.shownInputDialog?.getText().substring(0, maxInputFieldTextLength)),
            }
        }

        if (packet) {
            const cleanPacket = cleanRecord(packet)
            if (cleanPacket) {
                clientPackets[client.username] = cleanPacket
            }
        }
    }

    const packet: RemoteServerUpdatePacket = {
        clients: cleanRecord(clientPackets),
        readyMaps: multi.server.notifyReadyMaps,
    }
    multi.server.notifyReadyMaps = undefined

    const cleanPacket = cleanRecord(packet)
    if (cleanPacket) {
        const toSend = multi.server.settings.connection.forceJsonCommunication
            ? cleanPacket
            : RemoteUpdatePacketEncoderDecoder.encode(cleanPacket)
        conn.send('update', toSend)
    }
}

export interface RemoteServerUpdatePacket {
    clients?: RemoteServerClientPackets
    readyMaps?: MapName[]
}
export type GenerateType = RemoteServerUpdatePacket

type RemoteServerClientPackets = Record<Username, RemoteServerClientPacket>

export interface RemoteServerClientPacket {
    input?: InputData
    gamepad?: GamepadManagerData
    inputFieldText?: string
}
export function isRemoteServerUpdatePacket(_data: unknown): _data is RemoteServerUpdatePacket {
    const data = _data as RemoteServerUpdatePacket
    if (typeof data != 'object' || !data) return false

    const input = data.clients
    if (!input) return true
    if (typeof input !== 'object' || !input) return false
    if (!isRemoteServerInputPacket(input)) return false

    return true
}
function isRemoteServerInputPacket(_data: unknown): _data is RemoteServerClientPackets {
    const data = _data as RemoteServerClientPackets

    if (typeof data != 'object' || !data) return false
    for (const username in data) {
        const client = multi.server.clients.get(username)
        if (!client) continue

        const packet = data[username]
        if (!packet) return true

        if (typeof packet != 'object' || !packet) return false

        if (packet.input && !isInputData(packet.input)) return false

        if (packet.gamepad && !isGamepadManagerData(packet.gamepad)) return false

        if (
            packet.inputFieldText !== undefined &&
            (typeof packet.inputFieldText !== 'string' || packet.inputFieldText.length > maxInputFieldTextLength)
        )
            return false
    }

    return true
}
