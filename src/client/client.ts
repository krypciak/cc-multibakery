import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import type { DeterMineInstance } from 'cc-determine/src/instance'
import { ServerPlayer } from '../server/server-player'
import { assert } from '../misc/assert'
import { CCMap } from '../server/ccmap/ccmap'
import { prestart } from '../plugin'
import { addAddon, removeAddon } from '../dummy/dummy-box-addon'
import { clearForceGamepad, forceGamepad } from './force-gamepad'
import { initMapInteractEntries } from './map-interact'
import { waitForScheduledTask } from '../server/server'
import {
    createClientConnectionInfoLabel,
    createClientNetworkPacketTrafficLabel,
    createClientPingLabel,
} from './client-label-draw'
import { RemoteServer } from '../server/remote/remote-server'
import { isUsernameValid } from '../misc/username-util'
import { PhysicsServer } from '../server/physics/physics-server'
import { addCombatantParty } from '../misc/combatant-party-api'

declare global {
    namespace ig {
        var client: Client | undefined
    }
}

export type ClientSettings = {
    username: string
    remote: boolean
    noShowInstance?: boolean
    forceDraw?: boolean
    mapName?: string
} & (
    | {
          inputType: 'clone'
          initialInputType?: ig.INPUT_DEVICES
      }
    | {
          inputType: 'puppet'
      }
)

export class Client {
    player!: ServerPlayer
    inst!: InstanceinatorInstance
    determinism!: DeterMineInstance /* determinism is only used for visuals */

    private destroyed: boolean = false

    lastPingMs: number = 0

    constructor(public settings: ClientSettings) {
        assert(isUsernameValid(settings.username))
    }

    async init() {
        this.inst = await instanceinator.copy(
            multi.server.baseInst,
            'localclient-' + this.settings.username,
            multi.server.settings.displayClientInstances &&
                !this.settings.noShowInstance &&
                (!this.settings.remote || multi.server.settings.displayRemoteClientInstances),
            this.settings.forceDraw,
            inst => {
                inst.ig.client = this
            }
        )

        this.determinism = new determine.Instance('welcome to hell')
        determine.append(this.determinism)

        const inputManager = this.initInputManager()
        this.player = new ServerPlayer(this.settings.username, inputManager, multi.server instanceof RemoteServer)

        new dummy.BoxGuiAddon.Username(this.inst.ig.game)
        new dummy.BoxGuiAddon.Menu(this.inst.ig.game)

        if (multi.server instanceof RemoteServer) {
            createClientPingLabel(this)
            createClientConnectionInfoLabel(this)
            createClientNetworkPacketTrafficLabel(this)
        }
    }

    private initInputManager() {
        removeAddon(this.inst.ig.gamepad, this.inst.ig.game)
        let inputManager: dummy.InputManager
        if (this.settings.inputType == 'puppet') {
            const puppet = new dummy.input.Puppet.InputManager()
            inputManager = puppet
            this.inst.ig.input = puppet.mainInput
            this.inst.ig.gamepad = puppet.mainGamepadManager
        } else if (this.settings.inputType == 'clone') {
            this.inst.ig.gamepad = new multi.class.SingleGamepadManager()
            inputManager = new dummy.input.Clone.InputManager(
                this.inst.ig.input,
                this.inst.ig.gamepad,
                this.settings.initialInputType ?? ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE
            )
        } else assert(false)
        addAddon(this.inst.ig.gamepad, this.inst.ig.game)

        return inputManager
    }

    private attemptRecovery(e: unknown) {
        if (!multi.server.attemptCrashRecovery) throw e

        assert(this.player)
        const map = this.player.getMap()
        map.attemptRecovery(e)
    }

    update() {
        try {
            ig.game.update()
        } catch (e) {
            this.attemptRecovery(e)
        }
    }

    deferredUpdate() {
        try {
            ig.game.deferredUpdate()
            ig.input.clearPressed()
        } catch (e) {
            this.attemptRecovery(e)
        }
    }

    updateGamepadForcer() {
        assert(instanceinator.id == this.inst.id)
        if (this.player.inputManager instanceof dummy.input.Puppet.InputManager) return

        if (this.player.inputManager.inputType == ig.INPUT_DEVICES.GAMEPAD) {
            forceGamepad(this)
        } else {
            clearForceGamepad(this)
        }
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        await this.player.teleport(mapName, marker)
        const map = this.player.getMap()
        await this.linkMapToInstance(map)

        for (const obj of map.onLinkChange) obj.onLink(this)
    }

    private async linkMapToInstance(map: CCMap) {
        const cig = this.inst.ig
        const mig = map.inst.ig

        cig.game.size = mig.game.size
        cig.game.mapName = mig.game.mapName
        cig.game.entities = mig.game.entities
        cig.game.entitiesByNetid = mig.game.entitiesByNetid
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
        const msc = map.inst.sc

        rehookObservers(csc.model.player.params, this.player.dummy.model.params)
        rehookObservers(csc.model.player, this.player.dummy.model)
        csc.model.player = this.player.dummy.model
        csc.pvp = msc.pvp

        await waitForScheduledTask(this.inst, () => {
            sc.model.enterNewGame()
            sc.model.enterGame()
            for (const entry of ig.interact.entries) ig.interact.removeEntry(entry)

            for (const addon of ig.game.addons.teleport) addon.onTeleport(ig.game.mapName, undefined, undefined)
            for (const addon of ig.game.addons.levelLoadStart) addon.onLevelLoadStart(map.rawLevelData)

            ig.ready = true
            const loader = new ig.Loader()
            loader.load()
            ig.game.currentLoadingResource = loader

            initMapInteractEntries(map.inst)

            this.updateGamepadForcer()

            sc.model.enterGame()
        })
        await waitForScheduledTask(map.inst, () => {
            for (const client of Object.values(multi.server.clients)) {
                if (client instanceof Client) {
                    client.player.dummy.model.updateStats()
                    sc.Model.notifyObserver(client.player.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
                }
            }
            this.player.dummy.party = addCombatantParty(`player${this.inst.id}`)
        })
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true
        if (this.inst.ig.gamepad.destroy) {
            this.inst.ig.gamepad.destroy()
        }
        this.player.destroy()
        for (const obj of this.player.getMap().onLinkChange) obj.onDestroy(this)

        multi.server.serverInst.apply()
        determine.apply(multi.server.serverDeterminism)

        instanceinator.delete(this.inst)
        determine.delete(this.determinism)
    }
}

function rehookObservers(from: sc.Model, to: sc.Model) {
    to.observers.push(...from.observers)
}

function getClient(username: string, noAssert?: boolean): Client | undefined {
    if (!multi.server) return
    const client = multi.server.clients[username]
    if (!noAssert) assert(client)
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
            const client = getClient(this.data.username, true)
            if (!client) return this.parent()

            const camera = ig.camera
            ig.camera = client.inst.ig.camera
            this.parent()
            ig.camera = camera
        },
    })

    /* dont show title screen when client gets created, instead show a black screen */
    sc.TitleScreenGui.inject({
        init() {
            this.parent()
            if (!ig.client) return
            this.introGui.timeLine = [
                { time: 10000, gui: 'baseBG', state: 'DEFAULT' },
                { time: 0, end: true },
            ]
        },
    })

    // @ts-expect-error
    sc.Model.notifyObserver = function (model: sc.Model & ig.Class, message: number, data?: unknown) {
        // console.log('nofifyObserver', findClassName(model), message, data)
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
                if (inst) {
                    waitForScheduledTask(inst, () => {
                        o.modelChanged(model, message, data)
                    })
                } else model.observers.erase(o)

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

    ig.EVENT_STEP.SHOW_TUTORIAL_START.inject({
        start(data, eventCall) {
            if (!multi.server) return this.parent(data, eventCall)
            ;(data as any).done = true
            ;(data as any).accept = false
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
    if (!PHYSICS) return
    ig.Game.inject({
        deferredUpdate() {
            this.parent()
            if (!(multi.server instanceof PhysicsServer)) return
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

            const inMenu = subState != sc.GAME_MODEL_SUBSTATE.RUNNING
            if (inMenu) {
                inp.block.blockBoth('PAUSED')
            } else {
                inp.block.unblockBoth('PAUSED')
            }
        },
    })
})
