import { assert } from '../misc/assert'
import { prestart } from '../plugin'

import * as inputBackup from './dummy-input'
import './dummy-box-impl'
import { RemoteServer } from '../server/remote/remote-server'

declare global {
    namespace NodeJS {
        interface Global {
            dummy: typeof dummy
        }
    }

    namespace dummy {
        namespace DummyPlayer {
            interface Settings extends ig.Entity.Settings {
                inputManager: dummy.InputManager
                data: dummy.DummyPlayer.Data
            }
            interface Data {
                username: string
                isControlBlocked?: boolean
                inCutscene?: boolean
            }
        }
        interface DummyPlayer extends ig.ENTITY.Player {
            inputManager: dummy.InputManager
            data: dummy.DummyPlayer.Data
            itemConsumer: dummy.ItemConsumption
        }
        interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
            new (x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): DummyPlayer
        }
        var DummyPlayer: DummyPlayerConstructor
    }
}

global.dummy = window.dummy ??= {} as any
prestart(() => {
    dummy.DummyPlayer = ig.ENTITY.Player.extend({
        init(_x, _y, _z, settings) {
            settings.name = settings.data.username
            sc.PlayerBaseEntity.prototype.init.call(this, 0, 0, 0, settings)

            assert(settings.inputManager)
            this.inputManager = settings.inputManager
            this.inputManager.player = this

            this.data = settings.data

            this.levelUpNotifier = new sc.PlayerLevelNotifier()
            this.itemConsumer = new dummy.ItemConsumption(this)

            this.model = new dummy.PlayerModel(this)
            sc.Model.addObserver(this.model, this)
            sc.Model.addObserver(sc.model, this)
            this.initModel()

            sc.Model.addObserver(sc.playerSkins, this)
            this.charging.fx = new sc.CombatCharge(this, true)
            sc.combat.addActiveCombatant(this)
        },
        update() {
            inputBackup.apply(this.inputManager)
            this.parent()
            inputBackup.restore()
        },
        updateAnimSheet(updateFx) {
            /* disable skins for dummy players */
            const backup = sc.playerSkins
            sc.playerSkins = {
                // @ts-expect-error
                getCurrentSkin() {
                    return null
                },
            }

            this.parent(updateFx)

            sc.playerSkins = backup
        },
        onKill(_dontRespawn?: boolean) {
            this.parent(true)
        },
        showChargeEffect(level) {
            /* prevent crashes */
            if (!this.cameraHandle) this.cameraHandle = { setZoom() {} } as any
            this.parent(level)
            if (!(this.cameraHandle instanceof ig.Camera.TargetHandle)) this.cameraHandle = undefined as any
        },
        clearCharge() {
            /* prevent crashes */
            this.cameraHandle ??= { setZoom() {} } as any
            this.parent()
            if (!(this.cameraHandle instanceof ig.Camera.TargetHandle)) this.cameraHandle = undefined as any
        },
        isControlBlocked() {
            return this.data.isControlBlocked || this.data.inCutscene || this.parent()
        },
    })
}, 1)

prestart(() => {
    ig.ENTITY.Crosshair.inject({
        init(x, y, z, settings) {
            if (settings.thrower instanceof dummy.DummyPlayer) settings.uuid = 'crosshair-' + settings.thrower.uuid
            this.parent(x, y, z, settings)
        },
        deferredUpdate() {
            if (!(this.thrower instanceof dummy.DummyPlayer)) return this.parent()

            let inp = this.thrower.inputManager
            if (multi.server instanceof RemoteServer) {
                const clientInp = multi.server.clients[this.thrower.data.username]?.player?.inputManager
                if (clientInp?.player) inp = clientInp
            }
            inputBackup.apply(inp)

            this.parent()
            inputBackup.restore()
        },
    })
})

declare global {
    namespace dummy {
        interface PlayerModel extends sc.PlayerModel {
            dummy: dummy.DummyPlayer
        }
        interface PlayerModelConstructor extends ImpactClass<PlayerModel> {
            new (dummy: dummy.DummyPlayer): PlayerModel
        }
        var PlayerModel: PlayerModelConstructor
    }
}
prestart(() => {
    function replace(this: dummy.PlayerModel, ...args: unknown[]) {
        const backup = ig.game.playerEntity
        ig.game.playerEntity = this.dummy
        // @ts-expect-error
        const ret = this.parent(...args)
        ig.game.playerEntity = backup
        return ret
    }

    dummy.PlayerModel = sc.PlayerModel.extend({
        init(dummy) {
            this.parent()
            this.dummy = dummy
            this.setConfig(sc.model.leaConfig)
        },
        updateLoop: replace,
        enterElementalOverload: replace,
        setElementMode: replace,
        onVarAccess: replace,
    })
}, 2)

declare global {
    namespace dummy {
        interface ItemConsumption extends sc.ItemConsumption {
            player: dummy.DummyPlayer
        }
        interface ItemConsumptionConstructor extends ImpactClass<ItemConsumption> {
            new (player: dummy.DummyPlayer): ItemConsumption
        }
        var ItemConsumption: ItemConsumptionConstructor
    }
}
prestart(() => {
    function replace(this: dummy.ItemConsumption, ...args: unknown[]) {
        inputBackup.apply(this.player.inputManager)
        // @ts-expect-error
        const ret = this.parent(...args)
        inputBackup.restore()
        return ret
    }
    dummy.ItemConsumption = sc.ItemConsumption.extend({
        init(player) {
            this.parent()
            this.player = player
        },
        runItemUseAction: replace,
        runHealChange: replace,
        runStatChange: replace,
    })
}, 2)

prestart(() => {
    ig.ENTITY.TouchTrigger.inject({
        update() {
            this.parent()
            /* todo make dummies trigger this */
        },
    })
}, 2)
