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
                currentSkin: string
            }
            interface DummyPlayerConstructor extends ImpactClass<DummyPlayer> {
                new (): DummyPlayer
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
        }
    }
}

ig.dummy ??= {} as any

ig.dummy.DummyPlayer = ig.ENTITY.Player.extend({
    init() {
        sc.PlayerBaseEntity.prototype.init.bind(this)(0, 0, 0, {})

        this.levelUpNotifier = new sc.PlayerLevelNotifier()
        this.itemConsumer = new sc.ItemConsumption()

        this.model = new sc.PlayerModel()
        this.model.setConfig(sc.model.leaConfig)
        sc.Model.addObserver(this.model, this)
        sc.Model.addObserver(sc.model, this)
        this.initModel()

        sc.Model.addObserver(sc.playerSkins, this)
        this.charging.fx = new sc.CombatCharge(this, true)
        sc.combat.addActiveCombatant(this)

        this.input = new ig.dummy.Input()
        this.cameraHandle = {
            // @ts-expect-error
            setZoom() {},
            setOffset() {},
        }
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
    show() {
        const backup = sc.PlayerCrossHairController
        sc.PlayerCrossHairController = ig.dummy.PlayerCrossHairController
        this.parent()
        sc.PlayerCrossHairController = backup

        this.crosshairController = this.gui.crosshair.controller
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
})

ig.dummy.Input = ig.Input.extend({
    init() {
        this.bindings = ig.input.bindings
    },
    initMouse() {},
    initKeyboard() {},
    initAccelerometer() {},

    setInput(input) {
        for (const key in input) {
            const value = input[key as keyof UpdateInput]
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
