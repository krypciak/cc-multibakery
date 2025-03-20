import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { ServerPlayer } from '../server/server-player'
import { assert } from '../misc/assert'
import { LocalServer, waitForScheduledTask } from '../server/local-server'
import { LocalDummyClientSettings } from './local-dummy-client'
import { CCMap } from '../server/ccmap'
import { prestart } from '../plugin'
import { Client, ClientSettings } from './client'

export interface LocalSharedClientSettings extends ClientSettings {
    baseInst: InstanceinatorInstance
}

export class LocalSharedClient implements Client<LocalDummyClientSettings> {
    player!: ServerPlayer
    inst!: InstanceinatorInstance
    determinism!: DeterMineInstance /* determinism is only used for visuals */

    constructor(public s: LocalSharedClientSettings) {}

    async init() {
        assert(multi.server instanceof LocalServer)
        this.inst = await instanceinator.Instance.copy(
            multi.server.baseInst,
            'localclient-' + this.s.username,
            multi.server.s.displayLocalClientMaps
        )
        instanceinator.append(this.inst)
        this.determinism = new determine.Instance('welcome to hell')
        determine.append(this.determinism)

        // if (!multi.headless) /* update tiling */ sc.options._setDisplaySize()
        // why no work???

        const inputManager = new dummy.inputManagers.Clone.InputManager(this.inst.ig.input)
        this.player = new ServerPlayer(this.s.username, undefined, inputManager)

        new dummy.BoxGuiAddon.Username(this.inst.ig.game)
        new dummy.BoxGuiAddon.Menu(this.inst.ig.game)
    }

    async teleport() {
        assert(multi.server instanceof LocalServer)

        const map = multi.server.maps[this.player.mapName]
        await this.linkMapToInstance(map)
    }

    async linkMapToInstance(map: CCMap) {
        const cig = this.inst.ig
        const mig = map.inst.ig

        cig.game.size = mig.game.size
        cig.game.mapName = mig.game.mapName
        cig.game.entities = mig.game.entities
        cig.game.entitiesByUUID = mig.game.entitiesByUUID
        cig.game.mapEntities = mig.game.mapEntities
        cig.game.shownEntities = mig.game.shownEntities
        cig.game.freeEntityIds = mig.game.freeEntityIds
        cig.game.namedEntities = mig.game.namedEntities
        cig.game.conditionalEntities = mig.game.conditionalEntities
        cig.game.maps = mig.game.maps
        cig.game.levels = mig.game.levels
        cig.game.maxLevel = mig.game.maxLevel
        cig.game.minLevelZ = mig.game.minLevelZ
        cig.game.masterLevel = mig.game.masterLevel

        cig.game.physics = mig.game.physics
        cig.game.events = mig.game.events
        cig.vars = mig.vars

        cig.game.playerEntity = this.player.dummy

        const csc = this.inst.sc
        // const msc = map.inst.sc

        csc.model.player = this.player.dummy.model

        await waitForScheduledTask(this.inst, () => {
            sc.model.enterNewGame()
            sc.model.enterGame()

            for (const addon of ig.game.addons.teleport) addon.onTeleport(ig.game.mapName, undefined, undefined)
            for (const addon of ig.game.addons.levelLoadStart) addon.onLevelLoadStart(map.rawLevelData)

            ig.ready = true
            const loader = new ig.Loader()
            loader.load()
            ig.game.currentLoadingResource = loader

            const cameraTarget = new ig.Camera.EntityTarget(this.player.dummy)
            const camera = new ig.Camera.TargetHandle(cameraTarget, 0, 0)
            ig.camera.replaceTarget(ig.camera.targets[0], camera)
        })
        await waitForScheduledTask(map.inst, () => {
            this.player.dummy.model.updateStats()
        })
    }
}

function getInp(): dummy.inputManagers.Clone.InputManager | undefined {
    if (multi.server instanceof LocalServer) {
        const client = multi.server.localSharedClientById[instanceinator.instanceId]
        if (client) {
            return client.player.dummy.inputManager as dummy.inputManagers.Clone.InputManager
        }
    }
}

prestart(() => {
    ig.Physics.inject({
        update() {
            if (getInp()) return
            this.parent()
        },
    })
    ig.Game.inject({
        deferredMapEntityUpdate() {
            if (getInp()) return
            this.parent()
        },
    })
    ig.EventManager.inject({
        update() {
            if (getInp()) return
            this.parent()
        },
    })
    ig.Camera.inject({
        onPostUpdate() {
            this.parent()
            const inp = getInp()
            if (inp) Vec2.assign(inp.screen, ig.game.screen)
        },
    })

    sc.Model.notifyObserver = function (model: sc.Model, message: number, data?: unknown) {
        for (const _o of model.observers) {
            const o = _o as sc.Model.Observer & ig.Class
            if (o._instanceId != instanceinator.instanceId) {
                // const inst = instanceinator.instances[o._instanceId]
                // waitForScheduledTask(inst, () => {
                //     o.modelChanged(model, message, data)
                // })
                // console.log('blocked cross-insetance notifyObserver call', model, message, data)
                continue
            }
            o.modelChanged(model, message, data)
        }
    }
})

declare global {
    namespace dummy.DummyPlayer {
        interface Data {
            currentMenu?: sc.MENU_SUBMENU
            currentSubState?: sc.GAME_MODEL_SUBSTATE
        }
    }
}
prestart(() => {
    ig.Game.inject({
        deferredUpdate() {
            this.parent()
            const inp = getInp()
            if (!inp) return
            inp.player.data.currentMenu = sc.menu.currentMenu
            const subState = inp.player.data.currentSubState = sc.model.currentSubState

            inp.ignoreInput = subState != sc.GAME_MODEL_SUBSTATE.RUNNING
        },
    })
})
