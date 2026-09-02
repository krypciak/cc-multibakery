import type { f64, u20 } from 'ts-binarifier/src/type-aliases'
import {
    filterClientOptionModelValues,
    type ClientOptionModelValues,
    type KeyType,
} from '../../client/client-option-model-link'
import {
    type GamepadManagerData,
    type InputData,
    isGamepadManagerData,
    isInputData,
} from '../../dummy/dummy-input-puppet'
import { assert } from '../../misc/assert'
import type { MapName, Username } from '../../net/binary/binary-types'
import { RemoteUpdatePacketEncoderDecoder } from '../../net/binary/remote-update-packet-encoder-decoder.generated'
import { cleanRecord, StateMemory } from '../../state/state-util'
import { assertRemote } from './remote-server-types'
import { packetDeepEqual } from '../../net/packet-deep-equal'
import { profile } from '../../misc/performance-profiling'
import { getCCUILibRingConfFrom } from '../../mod-compatibility/nax-ccuilib'

let remoteSenderStateMemory: StateMemory | undefined
const maxInputFieldTextLength = 50

export interface RemoteServerUpdatePacket {
    clients?: RemoteServerClientPackets
    readyMaps?: MapName[]
}
export type GenerateType = RemoteServerUpdatePacket
export function isRemoteServerUpdatePacket(_data: unknown): _data is RemoteServerUpdatePacket {
    const data = _data as RemoteServerUpdatePacket
    if (typeof data != 'object' || !data) return false

    const input = data.clients
    if (!input) return true
    if (typeof input !== 'object' || !input) return false
    if (!isRemoteServerInputPacket(input)) return false

    return true
}

export interface RemoteServerClientPacket {
    input?: InputData
    gamepad?: GamepadManagerData
    inputFieldText?: string
    options?: PartialRecord<KeyType, f64> // ClientOptionModelValues
    ccuilibRingConf?: Record<u20, string> // CCUILibRingConf
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

type RemoteServerClientPackets = Record<Username, RemoteServerClientPacket>

export class RemoteSender {
    @profile(undefined, 'remote sender', true)
    static collectAndSend() {
        assertRemote(multi.server)
        const conn = multi.server.netManager.conn
        if (!conn) return

        const clientPackets: RemoteServerClientPackets = {}
        for (const client of multi.server.clients.values()) {
            const inst = client.inst
            assert(inst)

            if (inst.ig.inPauseScreen) continue

            const input = inst.ig.input.getInput()
            const gamepad = inst.ig.gamepad.getInput()

            const memory = StateMemory.get(remoteSenderStateMemory)
            remoteSenderStateMemory ??= memory

            const options = filterClientOptionModelValues(
                (client.inst.sc?.options?.values as unknown as ClientOptionModelValues) ?? {}
            )
            const ccuilibRingConf = memory.isFirstTime() ? getCCUILibRingConfFrom(client.inst.nax!) : undefined
            const packet: RemoteServerClientPacket = {
                input,
                gamepad,
                inputFieldText: memory.diff(inst.ig.shownInputDialog?.getText().substring(0, maxInputFieldTextLength)),
                options: memory.diffRecord(options),
                ccuilibRingConf,
            }

            const cleanPacket = cleanRecord(packet)
            if (cleanPacket) {
                clientPackets[client.username] = cleanPacket
            }
        }

        const packet: RemoteServerUpdatePacket = {
            clients: cleanRecord(clientPackets),
            readyMaps: multi.server.notifyReadyMaps,
        }
        multi.server.notifyReadyMaps = undefined

        const cleanPacket = cleanRecord(packet)
        if (!cleanPacket) return

        const toSend = this.encodePacket(cleanPacket)
        this.verifyPacketEncoding(toSend, cleanPacket)

        conn.middleware.send('update', toSend)
    }

    @profile(undefined, 'remote sender', true)
    private static encodePacket(data: RemoteServerUpdatePacket) {
        assertRemote(multi.server)
        const forceJson = multi.server.settings.netInfo!.details.forceJsonCommunication
        return forceJson ? data : RemoteUpdatePacketEncoderDecoder.encode(data)
    }

    private static verifyPacketEncoding(data: unknown, originalPacket: RemoteServerUpdatePacket) {
        if (DEV && data instanceof Uint8Array) {
            const decoded = RemoteUpdatePacketEncoderDecoder.decode(data)
            assert(packetDeepEqual(originalPacket, decoded), 'remote packet decoding mismatch!')
        }
    }
}
