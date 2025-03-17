import { assert } from '../misc/assert'
import { prestart } from '../plugin'

import * as inputBackup from './dummy-input'

declare global {
    namespace NodeJS {
        interface Global {
            dummy: typeof dummy
        }
    }

    namespace dummy {
        namespace DummyPlayer {
            interface Settings extends ig.Entity.Settings {
                username: string
                ignoreInputForcer?: boolean
                inputManager: dummy.InputManager
            }
        }
        interface DummyPlayer extends ig.ENTITY.Player {
            inputManager: dummy.InputManager
            crosshairController: dummy.PlayerCrossHairController
            username: string
            usernameBox: sc.SmallEntityBox
            cameraHandle: any
            ignoreInputForcer: boolean

            showUsernameBox(this: this): void
            hideUsernameBox(this: this): void
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

global.dummy = window.dummy ??= {} as any
prestart(() => {
    /* todo cameahandle crash on eternal winter */
    dummy.DummyPlayer = ig.ENTITY.Player.extend({
        init(_x, _y, _z, settings) {
            sc.PlayerBaseEntity.prototype.init.bind(this)(0, 0, 0, {})

            assert(settings.inputManager)
            this.inputManager = settings.inputManager
            this.inputManager.player = this

            this.levelUpNotifier = new sc.PlayerLevelNotifier()
            this.itemConsumer = new sc.ItemConsumption()

            this.model = new dummy.PlayerModel(this)
            sc.Model.addObserver(this.model, this)
            sc.Model.addObserver(sc.model, this)
            this.initModel()

            sc.Model.addObserver(sc.playerSkins, this)
            this.charging.fx = new sc.CombatCharge(this, true)
            sc.combat.addActiveCombatant(this)

            this.ignoreInputForcer = settings.ignoreInputForcer ?? true
            this.username = settings.username
        },
        update() {
            const blocking = sc.inputForcer.isBlocking()
            if (blocking && this.ignoreInputForcer) sc.inputForcer.blocked = false

            inputBackup.apply(this.inputManager)
            this.parent()
            inputBackup.restore()

            if (this.ignoreInputForcer) sc.inputForcer.blocked = blocking
        },
        gatherInput() {
            return this.inputManager.gatherInput() ?? this.parent()
        },
        show() {
            const backup = sc.PlayerCrossHairController
            sc.PlayerCrossHairController = dummy.PlayerCrossHairController
            this.parent()
            sc.PlayerCrossHairController = backup

            this.crosshairController = this.gui.crosshair.controller
            this.crosshairController.inputManager = this.inputManager
        },
        showUsernameBox() {
            if (this.usernameBox) ig.gui.removeGuiElement(this.usernameBox)
            this.usernameBox = new sc.SmallEntityBox(this, this.username, 1e100)
            // this.usernameBox.stopRumble()
            ig.gui.addGuiElement(this.usernameBox)
        },
        hideUsernameBox() {
            if (!this.usernameBox) return
            this.usernameBox.doStateTransition('HIDDEN', false, true)
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
            this.usernameBox?.doStateTransition('HIDDEN')
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
            if (!this.cameraHandle) this.cameraHandle = { setZoom() {} }
            this.parent()
            if (!(this.cameraHandle instanceof ig.Camera.TargetHandle)) this.cameraHandle = undefined
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
            if (this.gamepadMode || !this.relativeCursorPos) {
                inputBackup.apply(this.inputManager!)
                this.parent(crosshair)
                inputBackup.restore()
            } else {
                Vec2.assign(crosshair.coll.pos, this.relativeCursorPos)
            }
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

prestart(() => {
    ig.ENTITY.TouchTrigger.inject({
        update() {
            this.parent()
            /* todo make dummies trigger this */
        },
    })
}, 2)
