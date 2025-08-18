import {
    disallowedInputActions,
    GamepadManagerData,
    InputData,
    isGamepadManagerData,
    isInputData,
} from '../../dummy/dummy-input-puppet'
import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { cleanRecord } from '../../state/state-util'
import { RemoteServer } from './remote-server'

prestart(() => {
    if (!REMOTE) return
    ig.Game.inject({
        update() {
            this.parent()
            if (multi.server instanceof RemoteServer && instanceinator.id == multi.server.serverInst.id) {
                send()
            }
        },
    })
})

function send() {
    assert(multi.server instanceof RemoteServer)
    const conn = multi.server.netManager.conn
    if (!conn) return

    const inputPackets: RemoteServerInputPacket = {}
    for (const username in multi.server.clients) {
        const client = multi.server.clients[username]
        const inst = client.inst
        assert(inst)

        const inPauseScreen = inst.ig.inPauseScreen
        let packet: ClientInputPacket | undefined

        if (!inPauseScreen) {
            const input = inst.ig.input.getInput(client.player.inputManager.inputType == ig.INPUT_DEVICES.GAMEPAD)
            if (input) {
                for (const action of disallowedInputActions) {
                    delete input.presses?.[action]
                    delete input.actions?.[action]
                }
            }

            const gamepad = inst.ig.gamepad.getInput()

            packet = {
                input,
                gamepad,
            }
        }

        if (packet) {
            inputPackets[username] = cleanRecord(packet)
        }
    }

    const packet: RemoteServerUpdatePacket | undefined = cleanRecord({
        input: cleanRecord(inputPackets),
        readyMaps: multi.server.notifyReadyMaps,
    })
    multi.server.notifyReadyMaps = undefined

    if (packet) conn.send('update', packet)
}

export interface RemoteServerUpdatePacket {
    input?: RemoteServerInputPacket
    readyMaps?: string[]
}
type RemoteServerInputPacket = PartialRecord</* username */ string, ClientInputPacket>

export interface ClientInputPacket {
    input?: InputData
    gamepad?: GamepadManagerData
    inPauseScreen?: boolean
}
export function isRemoteServerUpdatePacket(data: any): data is RemoteServerUpdatePacket {
    if (typeof data != 'object' || !data) return false

    const input = data.input
    if (!input) return true
    if (typeof input !== 'object' || !input) return false
    if (!isRemoteServerInputPacket(input)) return false

    return true
}
function isRemoteServerInputPacket(data: any): data is RemoteServerInputPacket {
    if (typeof data != 'object' || !data) return false
    for (const username in data) {
        const client = multi.server.clients[username]
        if (!client) continue

        const packet: any = data[username]
        if (!packet) return true

        if (typeof packet != 'object' || !packet) return false

        if (packet.input && !isInputData(packet.input)) return false

        if (packet.gamepad && !isGamepadManagerData(packet.gamepad)) return false
    }

    return true
}
