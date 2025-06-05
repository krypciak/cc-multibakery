import { assert } from '../misc/assert'
import { prestart } from '../plugin'

import * as inputBackup from './dummy-input'
import './dummy-box-impl'

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
            crosshairController: dummy.PlayerCrossHairController
            cameraHandle: any
            data: dummy.DummyPlayer.Data
            itemConsumer: dummy.ItemConsumption
        }
        interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
            new (x: number, y: number, z: number, settings: dummy.DummyPlayer.Settings): DummyPlayer
        }
        var DummyPlayer: DummyPlayerConstructor
    }

    interface EntityTypesInterface {
        'dummy.DummyPlayer': never
    }
}

export function getDummyUuidByUsername(username: string): string {
    return `dummy-${username}`
}
global.dummy = window.dummy ??= {} as any
prestart(() => {
    dummy.DummyPlayer = ig.ENTITY.Player.extend({
        init(_x, _y, _z, settings) {
            settings.name = settings.data.username
            settings.uuid = getDummyUuidByUsername(settings.data.username)
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
        show() {
            const backup = sc.PlayerCrossHairController
            sc.PlayerCrossHairController = dummy.PlayerCrossHairController
            this.parent()
            sc.PlayerCrossHairController = backup

            this.crosshairController = this.gui.crosshair.controller
            this.crosshairController.inputManager = this.inputManager
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
            if (!this.cameraHandle) this.cameraHandle = { setZoom() {} }
            this.parent(level)
            if (!(this.cameraHandle instanceof ig.Camera.TargetHandle)) this.cameraHandle = undefined
        },
        clearCharge() {
            /* prevent crashes */
            this.cameraHandle ??= { setZoom() {} }
            this.parent()
            if (!(this.cameraHandle instanceof ig.Camera.TargetHandle)) this.cameraHandle = undefined
        },
        isControlBlocked() {
            return this.data.isControlBlocked || this.data.inCutscene || this.parent()
        },
    })
    ig.registerEntityPath(dummy.DummyPlayer, 'dummy.DummyPlayer')
}, 1)

declare global {
    namespace dummy {
        interface PlayerCrossHairController extends sc.PlayerCrossHairController {
            inputManager?: dummy.InputManager
            relativeCursorPos?: Vec2
        }
        interface PlayerCrossHairControllerConstructor extends ImpactClass<PlayerCrossHairController> {
            new (): PlayerCrossHairController
        }
        var PlayerCrossHairController: PlayerCrossHairControllerConstructor
    }
}
prestart(() => {
    dummy.PlayerCrossHairController = sc.PlayerCrossHairController.extend({
        updatePos(crosshair) {
            this.gamepadMode = this.inputManager!.input.currentDevice == ig.INPUT_DEVICES.GAMEPAD
            this.parent(crosshair)
            if (this.gamepadMode || !this.relativeCursorPos) {
                this.parent(crosshair)
            } else {
                Vec2.assign(crosshair.coll.pos, this.relativeCursorPos)
            }
        },
    })

    ig.ENTITY.Crosshair.inject({
        deferredUpdate() {
            if (!(this.thrower instanceof dummy.DummyPlayer)) return this.parent()

            inputBackup.apply(this.thrower.inputManager)
            this.parent()
            inputBackup.restore()
        },
    })
}, 2)

declare global {
    namespace dummy {
        interface PlayerModel extends sc.PlayerModel {
            dummy: dummy.DummyPlayer
            _playerBackup: ig.ENTITY.Player

            playerBackup(this: this): void
            playerRestore(this: this): void
        }
        interface PlayerModelConstructor extends ImpactClass<PlayerModel> {
            new (dummy: dummy.DummyPlayer): PlayerModel
        }
        var PlayerModel: PlayerModelConstructor
    }
}
prestart(() => {
    dummy.PlayerModel = sc.PlayerModel.extend({
        init(dummy) {
            this.parent()
            this.dummy = dummy
            this.setConfig(sc.model.leaConfig)
        },
        playerBackup() {
            this._playerBackup = ig.game.playerEntity
            ig.game.playerEntity = this.dummy
        },
        playerRestore() {
            ig.game.playerEntity = this._playerBackup
        },
        // prettier-ignore
        updateLoop(...args) { this.playerBackup(); const ret = this.parent(...args); this.playerRestore(); return ret; },
        // prettier-ignore
        enterElementalOverload(...args) { this.playerBackup(); const ret = this.parent(...args); this.playerRestore(); return ret; },
        // prettier-ignore
        setElementMode(...args) { this.playerBackup(); const ret = this.parent(...args); this.playerRestore(); return ret; },
        // prettier-ignore
        onVarAccess(...args) { this.playerBackup(); const ret = this.parent(...args); this.playerRestore(); return ret; },
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
