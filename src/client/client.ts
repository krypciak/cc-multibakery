import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { ServerPlayer } from '../server/server-player'
import { assert } from '../misc/assert'
import { LocalServer, waitForScheduledTask } from '../server/local-server'
import { CCMap } from '../server/ccmap'
import { prestart } from '../plugin'
import { addAddon, removeAddon } from '../dummy/dummy-box-addon'
import { forceGamepad } from './force-gamepad'
import { initMapInteractEntries } from './map-interact'

declare global {
    namespace ig {
        var client: Client | undefined
    }
}

export interface ClientSettings {
    username: string
    forceInputType?: ig.INPUT_DEVICES
    createInputManager?: (client: Client) => dummy.InputManager
    noShowInstance?: boolean
    forceDraw?: boolean
}

export class Client {
    player!: ServerPlayer
    inst!: InstanceinatorInstance
    determinism!: DeterMineInstance /* determinism is only used for visuals */

    constructor(public settings: ClientSettings) {}

    async init() {
        assert(multi.server instanceof LocalServer)
        this.inst = await instanceinator.copy(
            multi.server.baseInst,
            'localclient-' + this.settings.username,
            multi.server.s.displayLocalClientMaps && !this.settings.noShowInstance,
            this.settings.forceDraw,
        )
        this.inst.ig.client = this

        this.determinism = new determine.Instance('welcome to hell')
        determine.append(this.determinism)

        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        this.inst.ig.gamepad = new multi.class.SingleGamepadManager()
        addAddon(this.inst.ig.gamepad, this.inst.ig.game)
        let inputManager: dummy.InputManager
        if (this.settings.createInputManager) {
            inputManager = this.settings.createInputManager(this)
        } else {
            inputManager = new dummy.input.Clone.InputManager(
                this.inst.ig.input,
                this.inst.ig.gamepad,
                this.settings.forceInputType
            )
        }
        this.player = new ServerPlayer(this.settings.username, undefined, inputManager)

        new dummy.BoxGuiAddon.Username(this.inst.ig.game)
        new dummy.BoxGuiAddon.Menu(this.inst.ig.game)
    }

    async teleport() {
        assert(multi.server instanceof LocalServer)

        const map = multi.server.maps[this.player.mapName]
        await this.linkMapToInstance(map)
    }

    private async linkMapToInstance(map: CCMap) {
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

        // cig.game.events = this.player.eventManager
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

            initMapInteractEntries(map.inst)
        })
        await waitForScheduledTask(map.inst, () => {
            assert(multi.server instanceof LocalServer)
            for (const client of Object.values(multi.server.clients)) {
                if (client instanceof Client) {
                    client.player.dummy.model.updateStats()
                    sc.Model.notifyObserver(client.player.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
                }
            }
            this.player.dummy.party = this.inst.id + 2
        })

        if (this.settings.forceInputType == ig.INPUT_DEVICES.GAMEPAD) forceGamepad(this)
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

function rehookObservers(from: sc.Model, to: sc.Model) {
    to.observers.push(...from.observers)
}

function getClient(username: string): Client | undefined {
    if (!(multi.server instanceof LocalServer)) return
    const client = multi.server.clients[username]
    assert(client)
    return client
}

prestart(() => {
    ig.Physics.inject({
        update() {
            if (ig.client) return
            this.parent()
        },
    })
    ig.Game.inject({
        deferredMapEntityUpdate() {
            if (ig.client) return
            this.parent()
        },
        varsChanged() {
            if (ig.client) return
            this.parent()
        },
    })
    ig.Camera.inject({
        onPostUpdate() {
            this.parent()
            const inp = ig.client?.player?.inputManager
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

    // @ts-expect-error
    sc.Model.notifyObserver = function (model: sc.Model & ig.Class, message: number, data?: unknown) {
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
            const inp = ig.client?.player?.inputManager
            if (!inp) return
            const menu = sc.menu.currentMenu
            const subState = sc.model.currentSubState
            if (inp.player) {
                inp.player.data.currentMenu = menu
                inp.player.data.currentSubState = subState
                inp.player.data.isControlBlocked = subState == sc.GAME_MODEL_SUBSTATE.ONMAPMENU
                inp.player.data.inCutscene = ig.client!.inst.ig.game.isControlBlocked()
            }
            if (!(inp instanceof dummy.input.Clone.InputManager)) return

            const inMenu = subState != sc.GAME_MODEL_SUBSTATE.RUNNING
            if (inMenu) {
                inp.ignoreKeyboardInput.add('PAUSED')
                inp.ignoreGamepadInput.add('PAUSED')
            } else {
                inp.ignoreKeyboardInput.delete('PAUSED')
                inp.ignoreGamepadInput.delete('PAUSED')
            }
        },
    })
})
