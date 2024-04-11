import { UpdateInput } from './api'

export {}
declare global {
    namespace ig {
        namespace dummy {
            namespace DummyPlayer {
                interface Settings {}
            }
            interface DummyPlayer extends ig.ENTITY.Player {
                input: ig.dummy.Input
                nextGatherInput: ig.ENTITY.Player.PlayerInput
                crosshairController: ig.dummy.PlayerCrossHairController
                username: string
                usernameBox: sc.SmallEntityBox
                cameraHandle: any

                showUsernameBox(this: this): void
                hideUsernameBox(this: this): void
            }
            interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
                new (username: string): DummyPlayer
            }
            var DummyPlayer: DummyPlayerConstructor

            interface Input extends ig.Input {
                setInput(this: this, input: UpdateInput): void
            }
            interface InputConstructor extends ImpactClass<Input> {
                new (): Input
            }
            var Input: InputConstructor

            interface PlayerCrossHairController extends sc.PlayerCrossHairController {
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
}

ig.dummy ??= {} as any

ig.dummy.DummyPlayer = ig.ENTITY.Player.extend({
    init(username) {
        sc.PlayerBaseEntity.prototype.init.bind(this)(0, 0, 0, {})

        this.levelUpNotifier = new sc.PlayerLevelNotifier()
        this.itemConsumer = new sc.ItemConsumption()

        this.model = new ig.dummy.PlayerModel(this)
        sc.Model.addObserver(this.model, this)
        sc.Model.addObserver(sc.model, this)
        this.initModel()

        sc.Model.addObserver(sc.playerSkins, this)
        this.charging.fx = new sc.CombatCharge(this, true)
        sc.combat.addActiveCombatant(this)

        this.username = username
        this.input = new ig.dummy.Input()
    },
    update() {
        const blocking = sc.inputForcer.isBlocking()
        if (blocking) sc.inputForcer.blocked = false

        const inputBackup = ig.input
        ig.input = this.input

        this.parent()

        ig.input = inputBackup

        sc.inputForcer.blocked = blocking
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
        this.usernameBox.doStateTransition('HIDDEN')
        this.parent(true)
    },
    showChargeEffect(level) {
        /* prevent crashes */
        this.cameraHandle = { setZoom() {} }
        this.parent(level)
        this.cameraHandle = undefined
    },
    clearCharge() {
        /* prevent crashes */
        this.cameraHandle = { setZoom() {} }
        this.parent()
        this.cameraHandle = undefined
    },
})

ig.dummy.Input = ig.Input.extend({
    init() {
        this.bindings = ig.input.bindings
    },
    initMouse() {},
    initKeyboard() {},
    initAccelerometer() {},

    setInput(input) {
        for (const key of Object.keysT(input)) {
            const value = input[key]
            if (typeof value === 'function') continue
            // @ts-expect-error
            this[key] = value
        }
    },
})

ig.dummy.PlayerCrossHairController = sc.PlayerCrossHairController.extend({
    updatePos(crosshair) {
        if (this.gamepadMode || !this.relativeCursorPos) return this.parent(crosshair)
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
