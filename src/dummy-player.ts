import { DummyUpdateInput, getDummyUpdateInputFromIgInput } from './api'

export {}
declare global {
    namespace ig {
        namespace dummy {
            namespace DummyPlayer {
                interface Settings extends ig.Entity.Settings {
                    username: string
                    ignoreInputForcer?: boolean
                }
            }
            interface DummyPlayer extends ig.ENTITY.Player {
                input: ig.dummy.Input
                nextGatherInput: ig.ENTITY.Player.PlayerInput
                crosshairController: ig.dummy.PlayerCrossHairController
                username: string
                usernameBox: sc.SmallEntityBox
                cameraHandle: any
                ignoreInputForcer: boolean

                showUsernameBox(this: this): void
                hideUsernameBox(this: this): void
            }
            interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
                new (x: number, y: number, z: number, settings: ig.dummy.DummyPlayer.Settings): DummyPlayer
            }
            var DummyPlayer: DummyPlayerConstructor

            interface Input extends ig.Input {
                _lastInput: DummyUpdateInput

                getInput(this: this): DummyUpdateInput
                setInput(this: this, input: DummyUpdateInput): void
            }
            interface InputConstructor extends ImpactClass<Input> {
                new (): Input
            }
            var Input: InputConstructor

            interface PlayerCrossHairController extends sc.PlayerCrossHairController {
                input?: ig.dummy.Input
                relativeCursorPos?: Vec2
            }
            interface PlayerCrossHairControllerConstructor extends ImpactClass<PlayerCrossHairController> {
                new (): PlayerCrossHairController
            }
            var PlayerCrossHairController: PlayerCrossHairControllerConstructor

            interface PlayerModel extends sc.PlayerModel {
                dummy: ig.dummy.DummyPlayer
                _playerBackup: ig.ENTITY.Player

                playerBackup(this: this): void
                playerRestore(this: this): void
            }
            interface PlayerModelConstructor extends ImpactClass<PlayerModel> {
                new (dummy: ig.dummy.DummyPlayer): PlayerModel
            }
            var PlayerModel: PlayerModelConstructor
        }
    }

    interface EntityTypesInterface {
        'ig.dummy.DummyPlayer': never
    }
}

ig.dummy ??= {} as any

/* todo cameahandle crash on eternal winter */
ig.dummy.DummyPlayer = ig.ENTITY.Player.extend({
    init(_x, _y, _z, settings) {
        const rand = new Array(3).fill(null).map(_ => (Math.random() * 100).floor())
        sc.PlayerBaseEntity.prototype.init.bind(this)(rand[0], rand[1], rand[2], {})

        this.levelUpNotifier = new sc.PlayerLevelNotifier()
        this.itemConsumer = new sc.ItemConsumption()

        this.model = new ig.dummy.PlayerModel(this)
        sc.Model.addObserver(this.model, this)
        sc.Model.addObserver(sc.model, this)
        this.initModel()

        sc.Model.addObserver(sc.playerSkins, this)
        this.charging.fx = new sc.CombatCharge(this, true)
        sc.combat.addActiveCombatant(this)

        this.ignoreInputForcer = settings.ignoreInputForcer ?? true
        this.username = settings.username
        this.input = new ig.dummy.Input()
    },
    update() {
        const blocking = sc.inputForcer.isBlocking()
        if (blocking && this.ignoreInputForcer) sc.inputForcer.blocked = false

        const inputBackup = ig.input
        ig.input = this.input

        this.parent()

        ig.input = inputBackup

        if (this.ignoreInputForcer) sc.inputForcer.blocked = blocking
    },
    gatherInput() {
        return this.nextGatherInput ?? this.parent()
    },
    show() {
        const backup = sc.PlayerCrossHairController
        sc.PlayerCrossHairController = ig.dummy.PlayerCrossHairController
        this.parent()
        sc.PlayerCrossHairController = backup

        this.crosshairController = this.gui.crosshair.controller
        this.crosshairController.input = this.input
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
ig.registerEntityPath(ig.dummy.DummyPlayer, 'ig.dummy.DummyPlayer')

ig.dummy.Input = ig.Input.extend({
    init() {
        this.bindings = ig.input.bindings
    },
    getInput() {
        return this._lastInput ?? getDummyUpdateInputFromIgInput(this)
    },
    setInput(input) {
        this._lastInput = input
        for (const key of Object.keysT(input)) {
            const value = input[key]
            if (typeof value === 'function') continue
            // @ts-expect-error
            this[key] = value
        }
    },
})

ig.dummy.PlayerCrossHairController = sc.PlayerCrossHairController.extend({
    isAiming() {
        const inputBackup = ig.input
        ig.input = this.input!
        const ret = this.parent()
        ig.input = inputBackup
        return ret
    },
    updatePos(crosshair) {
        if (!this.relativeCursorPos) return this.parent(crosshair)
        Vec2.assign(crosshair.coll.pos, this.relativeCursorPos)
    },
})

ig.dummy.PlayerModel = sc.PlayerModel.extend({
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

ig.ENTITY.TouchTrigger.inject({
    update() {
        this.parent()
        /* todo make dummies trigger this */
    },
})
