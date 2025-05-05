import { GamepadManagerData, InputData } from '../dummy/dummy-input-puppet'
import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { RemoteServer } from './remote-server'

prestart(() => {
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
        const input = dummy.input.Puppet.InputManager.getInputData(inst.ig.input)
        const gamepad = dummy.input.Puppet.InputManager.getGamepadManagerData(inst.ig.gamepad)

        inputPackets[username] = {
            input,
            gamepad,
        }
    }

    const packet: RemoteServerUpdatePacket = {
        input: inputPackets,
    }

    conn.send('update', packet)
}

export interface RemoteServerUpdatePacket {
    input: RemoteServerInputPacket
}
type RemoteServerInputPacket = Record</* username */ string, ClientInputPacket>
export interface ClientInputPacket {
    input: InputData
    gamepad?: GamepadManagerData
}
export function isRemoteServerUpdatePacket(data: any): data is RemoteServerUpdatePacket {
    if (typeof data != 'object' || !data) return false

    const input = data.input
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
        if (typeof packet != 'object' || !packet) return false

        const input = packet.input
        if (typeof input != 'object' || !input) return false

        const gamepad = packet.gamepad
        if (gamepad && typeof gamepad != 'object') return false
    }

    return true
}
