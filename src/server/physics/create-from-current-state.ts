import { openManagerServerPopup } from '../../client/menu/pause/server-manage-button'
import { assert } from '../../misc/assert'
import { entityNetidStatic } from '../../misc/entity-netid'
import { Opts } from '../../options'
import { getEntityTypeId } from '../../state/entity'
import { applyStateUpdatePacket, getStateUpdatePacket } from '../../state/states'
import { PhysicsServer } from './physics-server'

function filterOutProblematicEntityStates(packet: StateUpdatePacket) {
    if (packet.states) {
        for (const netid in packet.states) {
            if (entityNetidStatic.has(getEntityTypeId(netid))) continue
            delete packet.states[netid]
        }
    }
}

export async function createPhysicsServerFromCurrentState() {
    const origMapName = ig.game.mapName
    const playerPos = Vec3.create(ig.game.playerEntity.coll.pos)
    const playerFace = Vec2.create(ig.game.playerEntity.face)

    const origMapState = getStateUpdatePacket(true)
    filterOutProblematicEntityStates(origMapState)
    const origInputType = ig.input.currentDevice

    const server = new PhysicsServer({
        globalTps: Opts.serverGlobalTps,
        godmode: Opts.serverGodmode,
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,
        forceConsistentTickTimes: Opts.serverForceConsistentTickTimes,
        netInfo: Opts.serverEnableNet
            ? {
                  connection: {
                      httpPort: Number(Opts.serverHttpPort),
                      type: 'socket',
                  },
                  details: {
                      title: Opts.serverTitle,
                      description: Opts.serverDescription,
                  },
              }
            : undefined,
    })
    multi.setServer(server)

    await server.start()

    const username = Opts.clientLogin
    await server.createAndJoinClient({
        username,
        inputType: 'clone',
        remote: false,
        initialInputType: origInputType,
        mapName: origMapName,
    })
    server.masterUsername = username
    const client = server.clients[username]
    Vec3.assign(client.player.dummy.coll.pos, playerPos)
    Vec2.assign(client.player.dummy.face, playerFace)

    const map = server.maps[client.player.mapName]
    assert(map)
    map.inst.apply()
    applyStateUpdatePacket(origMapState, 0, true)
    server.serverInst.apply()

    client.inst.ig.game.scheduledTasks.push(() => {
        sc.model.enterPause()
        ig.multibakeryManageServerPopup = undefined
        openManagerServerPopup(true)
    })
}

export function closePhysicsServerAndSaveState() {
    assert(multi.server instanceof PhysicsServer)
    assert(multi.server.masterUsername)
    const client = multi.server.clients[multi.server.masterUsername]
    assert(client)

    const playerPos = Vec3.create(client.player.dummy.coll.pos)
    const playerFace = Vec2.create(client.player.dummy.face)

    const map = multi.server.maps[client.player.mapName]
    assert(map)
    map.inst.apply()
    const origMapState = getStateUpdatePacket(true)
    filterOutProblematicEntityStates(origMapState)
    multi.server.serverInst.apply()

    multi.destroyAndStartLoop()

    if (!ig.game.playerEntity) return

    Vec3.assign(ig.game.playerEntity.coll.pos, playerPos)
    Vec2.assign(ig.game.playerEntity.face, playerFace)

    applyStateUpdatePacket(origMapState, 0, true)
}
