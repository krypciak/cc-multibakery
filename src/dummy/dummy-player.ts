import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { RemoteServer } from '../server/remote/remote-server'
import { Client } from '../client/client'
import { CCMap } from '../server/ccmap/ccmap'
import { inputBackup } from './dummy-input'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../server/physics/physics-server'

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
            model: dummy.PlayerModel

            setInputManager(this: this, inputManager: InputManager): void
            getHeadIdx(this: this): number
            getClient(this: this, noAssert: true): Client | undefined
            getClient(this: this, noAssert?: false): Client
            getMap(this: this): CCMap
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

            this.data = settings.data
            this.setInputManager(settings.inputManager)

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
        setInputManager(inputManager) {
            this.inputManager = inputManager
            this.inputManager.player = this
        },
        getHeadIdx() {
            const playerName = this.model.config.name
            return sc.party.models[playerName].getHeadIdx()
        },
        getClient(noAssert) {
            const client = multi.server.clients.get(this.data.username)
            if (!noAssert) assert(client)
            return client!
        },
        getMap() {
            return this.getClient().getMap()
        },

        update() {
            /* client only null when client after client is destroyed */
            const client = this.getClient(true)
            if (client?.ready) {
                runTask(client.inst, () => inputBackup(this.inputManager, () => this.parent()))
            } else {
                inputBackup(this.inputManager, () => this.parent())
            }

            if (this.data.inCutscene) {
                if (this.coll.type != ig.COLLTYPE.NONE) this.coll.setType(ig.COLLTYPE.NONE)
            } else if (this.coll.type == ig.COLLTYPE.NONE) {
                this.coll.setType(ig.COLLTYPE.VIRTUAL)
            }
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
            this.model.destroy()
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
            return this.data.isControlBlocked || this.parent()
        },
        updateSkinPet(showSpawnFx) {
            return inputBackup(this.inputManager, () => this.parent(showSpawnFx))
        },
    })
}, 1)

prestart(() => {
    ig.ENTITY.Crosshair.inject({
        deferredUpdate() {
            if (!(this.thrower instanceof dummy.DummyPlayer)) return this.parent()

            let inp = this.thrower.inputManager
            let backup: sc.PlayerCrossHairController['updatePos'] | undefined
            if (multi.server instanceof RemoteServer) {
                const clientInp = multi.server.clients.get(this.thrower.data.username)?.inputManager
                if (clientInp?.player) {
                    inp = clientInp
                } else {
                    backup = this.controller.updatePos
                    this.controller.updatePos = () => {}
                }
            }
            inputBackup(inp, () => this.parent())

            if (backup) this.controller.updatePos = backup
        },
    })
})

declare global {
    namespace ig {
        interface Vars {
            unregisterVarAccessor(this: this, accessor: ig.Vars.Accessor): void
        }
    }
}
prestart(() => {
    ig.Vars.inject({
        unregisterVarAccessor(accessor) {
            this.varAccessors = this.varAccessors.filter(acc => acc.accessor != accessor)
        },
    })
})

declare global {
    namespace dummy {
        interface PlayerModel extends sc.PlayerModel {
            dummy: dummy.DummyPlayer

            destroy(this: this): void
        }
        interface PlayerModelConstructor extends ImpactClass<PlayerModel> {
            new (dummy: dummy.DummyPlayer): PlayerModel
        }
        var PlayerModel: PlayerModelConstructor
    }
}
prestart(() => {
    function replace<T>(this: dummy.PlayerModel & { parent(...args: unknown[]): T }, ...args: unknown[]): T {
        const backup = ig.game.playerEntity
        ig.game.playerEntity = this.dummy
        const ret = this.parent(...args)
        ig.game.playerEntity = backup
        return ret
    }

    dummy.PlayerModel = sc.PlayerModel.extend({
        init(dummy) {
            this.parent()
            this.dummy = dummy
            this.setConfig(new sc.PlayerConfig('Lea'))

            const client = this.dummy.getClient(true)
            if (multi.server instanceof PhysicsServer) assert(client)
            if (client) {
                runTask(client.inst, () => {
                    ig.vars.registerVarAccessor('item', this, 'VarItemEditor')
                    ig.vars.registerVarAccessor('equip', this, 'VarEquipEditor')
                    ig.vars.registerVarAccessor('player', this, 'VarPlayerEditor')
                    ig.vars.registerVarAccessor('chapter', this, 'VarChapterEditor')
                })
            }
        },
        updateLoop: replace,
        enterElementalOverload: replace,
        setElementMode: replace,
        onVarAccess: replace,
        destroy() {
            ig.vars.unregisterVarAccessor(this)

            const client = this.dummy.getClient(true)
            if (multi.server instanceof PhysicsServer) assert(client)
            if (client) {
                runTask(client.inst, () => {
                    ig.vars.unregisterVarAccessor(this)
                })
            }
        },
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
    function replace<T>(this: dummy.ItemConsumption & { parent(...args: unknown[]): T }, ...args: unknown[]): T {
        return inputBackup(this.player.inputManager, () => {
            return this.parent(...args)
        })
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
