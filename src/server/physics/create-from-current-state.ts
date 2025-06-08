import { openManagerServerPopup } from '../../client/menu/pause/server-manage-button'
import { assert } from '../../misc/assert'
import { Opts } from '../../options'
import { applyEntityStates, getFullEntityState } from '../../state/states'
import { PhysicsServer } from './physics-server'

export async function createPhysicsServerFromCurrentState() {
    const origMapName = ig.game.mapName
    const playerPos = Vec3.create(ig.game.playerEntity.coll.pos)
    const playerFace = Vec2.create(ig.game.playerEntity.face)

    const origMapState = getFullEntityState()
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
    applyEntityStates(origMapState, 0, true)
    server.serverInst.apply()

    client.inst.ig.game.scheduledTasks.push(() => {
        sc.model.enterPause()
        openManagerServerPopup(true)
    })
}

export async function closePhysicsServerAndSaveState() {
    assert(multi.server instanceof PhysicsServer)
    assert(multi.server.masterUsername)
    const client = multi.server.clients[multi.server.masterUsername]
    assert(client)

    const playerPos = Vec3.create(client.player.dummy.coll.pos)
    const playerFace = Vec2.create(client.player.dummy.face)

    const map = multi.server.maps[client.player.mapName]
    assert(map)
    map.inst.apply()
    const origMapState = getFullEntityState()
    multi.server.serverInst.apply()

    await multi.destroyAndStartLoop()

    Vec3.assign(ig.game.playerEntity.coll.pos, playerPos)
    Vec2.assign(ig.game.playerEntity.face, playerFace)

    applyEntityStates(origMapState, 0, true)
}
