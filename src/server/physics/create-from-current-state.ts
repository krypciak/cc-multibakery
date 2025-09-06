import { runTask } from 'cc-instanceinator/src/inst-util'
import { openManagerServerPopup } from '../../client/menu/pause/server-manage-button'
import { Opts } from '../../options'
import { PhysicsServer } from './physics-server'

export async function createPhysicsServerFromCurrentState() {
    const username = Opts.clientLogin
    multi.storage.savePlayerState(username, ig.game.playerEntity as dummy.DummyPlayer, ig.game.mapName, ig.game.marker)

    const playerDataBackup = {
        pos: Vec3.create(ig.game.playerEntity.coll.pos),
        face: Vec2.create(ig.game.playerEntity.face),
    }

    const origInputType = ig.input.currentDevice

    const server = new PhysicsServer({
        tps: Opts.serverGlobalTps,
        useAnimationFrameLoop: Opts.serverUseAnimationFrameLoop,
        godmode: Opts.serverGodmode,
        displayServerInstance: Opts.serverDisplayServerInstance,
        displayMaps: Opts.serverDisplayMaps,
        forceMapsActive: Opts.serverForceMapsActive,
        displayInactiveMaps: Opts.serverDisplayInactiveMaps,
        displayClientInstances: Opts.serverDisplayClientInstances,
        displayRemoteClientInstances: Opts.serverDisplayRemoteClientInstances,
        forceConsistentTickTimes: Opts.serverForceConsistentTickTimes,
        attemptCrashRecovery: Opts.serverAttemptCrashRecovery,
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
        save: {
            manualSaving: Opts.serverEnableSave,
        },
    })
    server.destroyOnLastClientLeave = true
    multi.setServer(server)

    await server.start()

    server.setMasterClient(
        await server.createAndJoinClient({
            username,
            inputType: 'clone',
            remote: false,
            initialInputType: origInputType,
        })
    )

    const client = server.clients[username]

    runTask(client.inst, () => {
        const { x, y, z } = playerDataBackup.pos
        ig.game.playerEntity.setPos(x, y, z)
        Vec2.assign(ig.game.playerEntity.face, playerDataBackup.face)

        sc.model.enterPause()
        ig.multibakeryManageServerPopup = undefined
        openManagerServerPopup(true)
    })
}

export async function closePhysicsServerAndSaveState() {
    multi.storage.save()
    await multi.destroyNextFrameAndStartLoop()

    if (!ig.game.playerEntity) return

    sc.model.enterRunning()
    ig.storage.loadAutosave()
}
