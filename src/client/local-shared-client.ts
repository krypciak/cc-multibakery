import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { ServerPlayer } from '../server/server-player'
import { assert } from '../misc/assert'
import { LocalServer, waitForScheduledTask } from '../server/local-server'
import { LocalDummyClientSettings } from './local-dummy-client'
import { CCMap } from '../server/ccmap'
import { prestart } from '../plugin'
import { Client, ClientSettings } from './client'
import { addAddon, removeAddon } from '../dummy/dummy-box-addon'
import { forceGamepad } from './force-gamepad'

export interface LocalSharedClientSettings extends ClientSettings {
    baseInst: InstanceinatorInstance
    forceInputType?: ig.INPUT_DEVICES
}

export class LocalSharedClient implements Client<LocalDummyClientSettings> {
    player!: ServerPlayer
    inst!: InstanceinatorInstance
    determinism!: DeterMineInstance /* determinism is only used for visuals */

    constructor(public s: LocalSharedClientSettings) {}

    async init() {
        assert(multi.server instanceof LocalServer)
        this.inst = await instanceinator.copy(
            multi.server.baseInst,
            'localclient-' + this.s.username,
            multi.server.s.displayLocalClientMaps
        )
        this.determinism = new determine.Instance('welcome to hell')
        determine.append(this.determinism)

        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        this.inst.ig.gamepad = new dummy.input.Clone.SingleGamepadManager()
        addAddon(this.inst.ig.gamepad, this.inst.ig.game)
        const inputManager = new dummy.input.Clone.InputManager(
            this.inst.ig.input,
            this.inst.ig.gamepad,
            this.s.forceInputType
        )
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

        removeAddon(cig.light, cig.game)
        cig.light = mig.light
        addAddon(cig.light, cig.game)

        removeAddon(cig.screenBlur, cig.game)
        cig.screenBlur = mig.screenBlur
        addAddon(cig.screenBlur, cig.game)

        removeAddon(cig.rumble, cig.game)
        cig.rumble = mig.rumble
        addAddon(cig.rumble, cig.game)

        cig.game.playerEntity = this.player.dummy

        const csc = this.inst.sc
        // const msc = map.inst.sc

        rehookObservers(csc.model.player.params, this.player.dummy.model.params)
        rehookObservers(csc.model.player, this.player.dummy.model)
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
        })
        await waitForScheduledTask(map.inst, () => {
            assert(multi.server instanceof LocalServer)
            for (const client of Object.values(multi.server.clients)) {
                if (client instanceof LocalSharedClient) {
                    client.player.dummy.model.updateStats()
                    sc.Model.notifyObserver(client.player.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
                }
            }

            if (!enemySet) {
                this.player.dummy.party = sc.COMBATANT_PARTY.ENEMY
                enemySet = true
            }
        })

        if (this.s.forceInputType == ig.INPUT_DEVICES.GAMEPAD) forceGamepad(this)
    }

    async destroy() {
        if (this.inst.ig.gamepad.destroy) {
            await this.inst.ig.gamepad.destroy()
        }
        await this.player.destroy()
        instanceinator.delete(this.inst)
        determine.delete(this.determinism)
    }
}
let enemySet = false

function rehookObservers(from: sc.Model, to: sc.Model) {
    to.observers.push(...from.observers)
}

function getInp(): dummy.input.Clone.InputManager | undefined {
    if (multi.server instanceof LocalServer) {
        const client = multi.server.localSharedClientById[instanceinator.id]
        if (client) {
            return client.player.dummy.inputManager as dummy.input.Clone.InputManager
        }
    }
}
function getClient(username: string): LocalSharedClient | undefined {
    if (!(multi.server instanceof LocalServer)) return
    const client = multi.server.clients[username]
    assert(client)
    if (!(client instanceof LocalSharedClient)) return
    return client
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
        varsChanged() {
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
    dummy.DummyPlayer.inject({
        update() {
            const client = getClient(this.data.username)
            if (!client) return this.parent()

            const camera = ig.camera
            ig.camera = client.inst.ig.camera
            this.parent()
            ig.camera = camera
        },
    })

    sc.Model.notifyObserver = function (model: sc.Model, message: number, data?: unknown) {
        // function rev<K extends string | number, V extends string | number>(rec: Record<K, V>): Record<V, K> {
        //     return Object.fromEntries(Object.entries(rec).map(([a, b]) => [b as V, a as K]))
        // }

        for (const _o of model.observers) {
            const o = _o as sc.Model.Observer & ig.Class
            if (o._instanceId != instanceinator.id) {
                // let msg: string = message.toString()
                // if (model instanceof sc.PlayerModel)
                //     msg = 'sc.PLAYER_MSG.' + rev(sc.PLAYER_MSG)[message as sc.PLAYER_MSG]
                // if (model instanceof sc.CombatParams)
                //     msg = 'sc.COMBAT_PARAM_MSG.' + rev(sc.COMBAT_PARAM_MSG)[message as sc.COMBAT_PARAM_MSG]
                // console.log('passing ', findClassName(model), msg, data)
                const inst = instanceinator.instances[o._instanceId]
                waitForScheduledTask(inst, () => {
                    o.modelChanged(model, message, data)
                })

                continue
            }
            o.modelChanged(model, message, data)
        }
    }

    ig.GuiHook.inject({
        onAttach(hook) {
            if (this._instanceId != hook!._instanceId) {
                console.warn('a sin has been commited', this._instanceId, hook!._instanceId)
                debugger
            }
            this.parent(hook)
        },
    })

    ig.SlowMotion.inject({
        /* fix slow motion (by disabling it) */
        add(factor, timer, name) {
            if (!multi.server) return this.parent(factor, timer, name)

            const handle = new ig.SlowMotionHandle(factor, timer, name)
            // this.slowMotions.push(b)
            if (name) {
                if (this.namedSlowMotions[name]) {
                    this.namedSlowMotions[name].clear()
                    this.namedSlowMotions[name].name = null
                }
                this.namedSlowMotions[name] = handle
            }
            return handle
        },
    })
    // @ts-expect-error
    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({
        start() {
            if (!multi.server) return this.parent()
            assert(ig.game.playerEntity == undefined)
            ig.game.playerEntity = {
                // @ts-expect-error
                hasCameraTarget: () => true,
            }
            this.parent()
            ig.game.playerEntity = undefined as any
        },
    })

    sc.EnemyType.inject({
        resolveItemDrops(enemyEntity) {
            if (!(multi.server instanceof LocalServer)) return this.parent(enemyEntity)
            const map = multi.server.mapsById[instanceinator.id]
            assert(map)
            assert(!ig.game.playerEntity)
            ig.game.playerEntity = map.players[0].dummy
            this.parent(enemyEntity)
            ig.game.playerEntity = undefined as any
        },
    })

    dummy.DummyPlayer.inject({
        kill(_levelChange) {},
        _onDeathHit(a) {
            if (!multi.server || !(this instanceof dummy.DummyPlayer)) return this.parent(a)

            if (this.dying == sc.DYING_STATE.ALIVE) {
                this.dying = sc.DYING_STATE.KILL_HIT
                // sc.combat.onCombatantDeathHit(a, this)
                ig.EffectTools.clearEffects(this)

                if (!this.skipRumble) {
                    const effect = new ig.Rumble.RumbleHandle('RANDOM', 'STRONG', 'FASTER', 0.3, false, true)
                    ig.rumble.addRumble(effect)
                }
                if (!sc.pvp.isCombatantInPvP(this)) {
                    this.effects.death.spawnOnTarget('pre_die', this, { duration: -1 })
                    this.coll.type = ig.COLLTYPE.IGNORE
                }

                this.dying = sc.DYING_STATE.ALIVE
                this.params.revive()

                ig.EffectTools.clearEffects(this)
                this.resetStunData()
            }
        },
    })
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
            const subState = (inp.player.data.currentSubState = sc.model.currentSubState)

            if (subState == sc.GAME_MODEL_SUBSTATE.RUNNING) {
                inp.ignoreKeyboardInput.delete('PAUSED')
                inp.ignoreGamepadInput.delete('PAUSED')
            } else {
                inp.ignoreKeyboardInput.add('PAUSED')
                inp.ignoreGamepadInput.add('PAUSED')
            }
        },
    })
})
