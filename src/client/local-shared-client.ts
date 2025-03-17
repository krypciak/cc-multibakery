import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { ServerPlayer } from '../server/server-player'
import { assert } from '../misc/assert'
import { LocalServer, waitForScheduledTask } from '../server/local-server'
import { LocalDummyClient, LocalDummyClientSettings } from './local-dummy-client'
import { CCMap } from '../server/ccmap'
import { prestart } from '../plugin'
import { getDummyUpdateKeyboardInputFromIgInput } from '../dummy-player'

export interface LocalSharedClientSettings extends LocalDummyClientSettings {
    baseInst: InstanceinatorInstance
}

export class LocalSharedClient extends LocalDummyClient {
    player!: ServerPlayer
    inst!: InstanceinatorInstance
    determinism!: DeterMineInstance /* determinism is only used for visuals */

    constructor(public s: LocalSharedClientSettings) {
        super(s)
    }

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
    }

    async teleport() {
        assert(multi.server instanceof LocalServer)
        await this.player.teleport(this.player.mapName, this.player.marker)
        const map = multi.server.maps[this.player.mapName]
        await this.linkMapToInstance(map)
    }

    async linkMapToInstance(map: CCMap) {
        // await new Promise<void>(res => setTimeout(res, 1000))
        console.log('link', map)
        const cig = this.inst.ig
        const mig = map.inst.ig

        cig.game.size = mig.game.size
        cig.game.mapName = mig.game.mapName
        cig.game.entities = mig.game.entities
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
        // this.player.dummy.input = new DummyInputAdapter(cig.input)

        const csc = this.inst.sc
        const msc = map.inst.sc

        csc.model.player = msc.model.player

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
    }
}

prestart(() => {
    ig.Physics.inject({
        update() {
            if (multi.server instanceof LocalServer) {
                const client = multi.server.localSharedClientById[instanceinator.instanceId]
                if (client) {
                    return
                }
            }
            this.parent()
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
                // console.log('unknown model! blocked cross-insetance notifyObserver call', model, message, data)
                continue
            }
            o.modelChanged(model, message, data)
        }
    }
})

interface DummyInputAdapter extends dummy.Input {
    realInput: ig.Input
}
interface DummyInputAdapterConstructor extends ImpactClass<DummyInputAdapter> {
    new (realInput: ig.Input): DummyInputAdapter
}
let DummyInputAdapter!: DummyInputAdapterConstructor

prestart(() => {
    DummyInputAdapter = dummy.Input.extend({
        init(realInput) {
            this.parent()
            this.realInput = realInput

            this.actions = realInput.actions
            this.presses = realInput.presses
            this.keyups = realInput.keyups
            // this.locks = realInput.locks
            // tis.delayedKeyup = realInput.delayedKeyup
            //
            // currentDevice/*: ig.INPUT_DEVICES*/: null,
            // isUsingMouse/*: boolean*/: false,
            // isUsingKeyboard/*: boolean*/: false,
            // isUsingAccelerometer/*: boolean*/: false,
            // mouse/*: Vec2*/: { x: 0, y: 0 },
            // accel/*: Vec3*/: { x: 0, y: 0, z: 0 },
            // mouseGuiActive/*: boolean*/: true,
            // lastMousePos/*: Vec2*/: { x: 0, y: 0 },
            // ignoreKeyboard/*: boolean*/: false,
        },
        clearPressed() {
            this.parent()
        },
        getInput() {
            return getDummyUpdateKeyboardInputFromIgInput(this.realInput)
        },
        setInput(_input) {
            throw new Error('Called setInput on DummyInputAdapter!')
        },
    })
}, 2)
