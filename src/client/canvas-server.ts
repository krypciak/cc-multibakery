import type { ClientPacket, DataConnection } from 'cc-canvas-server/src/connection-interface'
import { assert } from '../misc/assert'
import { LocalServer } from '../server/local-server'

export async function startCanvasServer() {
    canvasServer.server = new canvasServer.SocketIoServer()
    canvasServer.server.openListeners.push(onOpen)
    canvasServer.server.closeListeners.push(onClose)

    canvasServer.inputCallback = inputCallback
    canvasServer.requestInstanceId = requestInstanceId
    await canvasServer.server.start()
}

async function inputCallback(instanceId: number, data: ClientPacket) {
    assert(multi.server instanceof LocalServer)
    const inst = instanceinator.instances[instanceId]
    assert(inst)
    assert(inst.ig.client)
    const inp = inst.ig.client.player.inputManager
    assert(inp instanceof dummy.input.Puppet.InputManager)
    inp.input.setInput(data.input)
}
async function requestInstanceId(username: string) {
    assert(multi.server instanceof LocalServer)
    const client = await multi.server.createAndJoinClient({
        username,
        inputType: 'puppet',
        canvasServer: true,
        noShowInstance: true,
        forceDraw: true,
    })
    return client.inst.id
}

function onOpen(_conn: DataConnection) {}

function onClose(conn: DataConnection) {
    assert(multi.server instanceof LocalServer)
    const inst = instanceinator.instances[conn.instanceId]
    assert(inst)
    const client = inst.ig.client
    assert(client)
    console.log('destryoooing')
    client.destroy()
}
