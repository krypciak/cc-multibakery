import { assert } from '../misc/assert'
import type { CCMap } from '../server/ccmap/ccmap'
import { linkTimersModel } from '../server/ccmap/ccmap'
import { addAddon, removeAddon } from '../dummy/box/box-addon'
import { clearForceGamepad, forceGamepad } from './force-gamepad'
import { initMapInteractEntries } from './map-interact'
import { runTask } from 'cc-instanceinator/src/inst-util'
import {
    createClientConnectionInfoLabel,
    createClientNetworkPacketTrafficLabel,
    createClientPingLabel,
} from './client-label-draw'
import { isUsernameValid } from '../misc/username-util'
import { applyStateUpdatePacket } from '../state/states'
import { teleportPlayerToProperMarker } from '../server/ccmap/teleport-fix'
import { InstanceUpdateable } from '../server/instance-updateable'
import { updateDummyData } from './injects'
import { initMapsAndLevels } from '../server/ccmap/data-load'
import { linkMusic } from '../server/music'
import type { MapTpInfo } from '../server/server'
import { linkClientVars } from './client-var-link'
import type { Username } from '../net/binary/binary-types'
import { assertPhysics, isPhysics } from '../server/physics/is-physics-server'
import { isRemote } from '../server/remote/is-remote-server'

import './injects'
import './menu/server-list-menu'
import './menu/pause/pause-screen'
import './menu/map-overlay'

declare global {
    namespace ig {
        var client: Client | undefined
    }
}

export type ClientSettings = {
    username: Username
    remote: boolean
    noShowInstance?: boolean
    forceDraw?: boolean
    tpInfo?: MapTpInfo
} & (
    | {
          inputType: 'clone'
          initialInputType?: ig.INPUT_DEVICES
      }
    | {
          inputType: 'puppet'
      }
)

export class Client extends InstanceUpdateable {
    lastPingMs: number = 0

    username: Username
    inputManager!: dummy.InputManager
    dummy!: dummy.DummyPlayer
    tpInfo: MapTpInfo = { map: '' }
    nextTpInfo: MapTpInfo = { map: '' }
    ready: boolean = false
    playerAttachResolve?: (player: dummy.DummyPlayer) => void

    static async create(settings: ClientSettings): Promise<Client> {
        const client = new Client(settings)
        await client.init(settings)
        return client
    }

    private constructor(public settings: ClientSettings) {
        super()
        assert(isUsernameValid(settings.username))
        this.username = settings.username
    }

    private async init(settings: ClientSettings) {
        this.inst = await instanceinator.copy(
            multi.server.inst,
            { name: 'localclient-' + settings.username, display: this.isVisible(), forceDraw: settings.forceDraw },
            {
                preLoad: inst => {
                    inst.ig.client = this
                },
            }
        )
        assert(this.inst.ig.game)

        this.inputManager = this.initInputManager()

        new dummy.BoxGuiAddon.BoxGuiAddon(this.inst.ig.game)

        if (isRemote(multi.server)) {
            createClientPingLabel(this)
            createClientConnectionInfoLabel(this)
            createClientNetworkPacketTrafficLabel(this)
        }

        removeAddon(this.inst.sc.npcRunner, this.inst.ig.game)
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

        this.inst.ig.input.currentDevice = inputManager.inputType ?? ig.INPUT_DEVICES.KEYBOARD_AND_MOUSE

        return inputManager
    }

    protected attemptRecovery(e: unknown) {
        if (!multi.server.settings.attemptCrashRecovery) throw e

        const map = this.getMap()
        map.attemptRecovery(e)
    }

    isActive() {
        return true
    }

    isVisible() {
        return !!(
            multi.server.settings.displayClientInstances &&
            !this.settings.noShowInstance &&
            (!this.settings.remote || multi.server.settings.displayRemoteClientInstances)
        )
    }

    preUpdate() {
        if (this.inputManager instanceof dummy.input.Puppet.InputManager) {
            this.inputManager.mainInputData.popInput()
            this.inputManager.mainGamepadManagerData.popInput()
        }
        super.preUpdate()
    }

    update() {
        super.update()

        updateDummyData(this)
    }

    updateGamepadForcer() {
        assert(instanceinator.id == this.inst.id)
        if (this.inputManager instanceof dummy.input.Puppet.InputManager) return

        if (this.inputManager.inputType == ig.INPUT_DEVICES.GAMEPAD) {
            if (this.inputManager.gamepadManager.activeGamepads.length == 0) {
                forceGamepad(this)
            }
        } else {
            clearForceGamepad(this)
        }
    }

    async teleportInitial(tpInfoOverride?: MapTpInfo) {
        const state = this.getSaveState(false)

        const tpInfo: MapTpInfo = {
            map: tpInfoOverride?.map ?? state?.map ?? multi.server.settings.defaultMap?.map ?? 'multibakery/dev',
            marker: tpInfoOverride?.marker ?? state?.marker ?? multi.server.settings.defaultMap?.marker ?? 'entrance',
        }
        await this.teleport(tpInfo)
    }

    private startTeleportOverlay() {
        runTask(this.inst, () => {
            const { r, g, b, timeIn, lighter } = ig.game.teleportColor
            ig.overlay.setColor(r, g, b, 1, timeIn, lighter)
            ig.game.currentTeleportColor.r = r
            ig.game.currentTeleportColor.g = g
            ig.game.currentTeleportColor.b = b
            ig.game.teleportColor.r = ig.game.teleportColor.g = ig.game.teleportColor.b = 0
            ig.game.teleportColor.lighter = false
        })
    }

    private stopTeleportOverlay() {
        runTask(this.inst, () => {
            ig.overlay.setAlpha(0, ig.game.teleportColor.timeOut)
            ig.game.teleportColor.timeOut = 0.3
            ig.game.teleportColor.timeIn = 0.3
        })
    }

    async teleport(tpInfo: MapTpInfo) {
        this.startTeleportOverlay()

        assert(instanceinator.id == multi.server.inst.id)
        if (this.dummy) {
            multi.storage.savePlayerState(this.username, this.dummy, tpInfo)
        }

        this.nextTpInfo = tpInfo

        this.ready = false

        let map: CCMap | undefined
        await Promise.all([
            (async () => {
                map = multi.server.maps.get(tpInfo.map)
                map ??= await multi.server.loadMap(tpInfo.map)
                await map.readyPromise
            })(),
            new Promise<void>(resolve => setTimeout(resolve, multi.server.settings.mapSwitchDelay ?? 0)),
        ])
        assert(map)

        const oldMap = multi.server.maps.get(this.tpInfo.map)

        if (oldMap) {
            oldMap.leave(this)
            for (const obj of oldMap.onLinkChange) obj.onClientUnlink?.(this)
        }

        this.tpInfo = tpInfo

        await runTask(map.inst, () => this.createPlayer())
        map.enter(this)

        if (isPhysics(multi.server)) {
            runTask(map.inst, () => {
                teleportPlayerToProperMarker(this.dummy, this.tpInfo.marker, undefined, true)
            })
        }
        this.ready = true

        this.linkMapToInstance(map)

        this.inst.ig.game.events.clear()

        for (const obj of map.onLinkChange) obj.onClientLink?.(this)

        multi.storage.save()

        this.stopTeleportOverlay()
    }

    private linkMapToInstance(map: CCMap) {
        runTask(this.inst, () => {
            const mig = map.inst.ig

            ig.game.mapName = mig.game.mapName
            ig.game.entities = mig.game.entities
            ig.game.entitiesByNetid = mig.game.entitiesByNetid
            ig.game.mapEntities = mig.game.mapEntities
            ig.game.shownEntities = mig.game.shownEntities
            ig.game.freeEntityIds = mig.game.freeEntityIds
            ig.game.namedEntities = mig.game.namedEntities
            ig.game.conditionalEntities = mig.game.conditionalEntities
            ig.game._deferredDetach = mig.game._deferredDetach
            ig.game.entityTypeIdCounterMap = mig.game.entityTypeIdCounterMap

            ig.light.shadowProviders = []
            const data = map.copyRawLevelData()
            initMapsAndLevels.call(ig.game, data)
            for (const levelName in mig.game.levels) {
                const level = mig.game.levels[levelName]
                if (level.collision) {
                    ig.game.levels[levelName].collision = level.collision
                }
            }

            ig.game.physics = mig.game.physics

            ig.light.lightHandles = mig.light.lightHandles
            ig.light.darknessHandles = mig.light.darknessHandles
            ig.light.screenFlashHandles = mig.light.screenFlashHandles

            linkClientVars(this, map.inst)
            linkMusic(this.inst, map.inst)
            linkTimersModel(this.inst, map.inst)

            removeAddon(ig.screenBlur, ig.game)
            ig.screenBlur = mig.screenBlur
            addAddon(ig.screenBlur, ig.game)

            removeAddon(ig.rumble, ig.game)
            ig.rumble = mig.rumble
            addAddon(ig.rumble, ig.game)

            /* cc-variable-charge-time */
            ig.chargeTimings = mig.chargeTimings

            ig.game.playerEntity = this.dummy

            const msc = map.inst.sc

            rehookObservers(this.dummy.model.params, sc.model.player.params)
            rehookObservers(this.dummy.model, sc.model.player)
            sc.model.player = this.dummy.model

            ig.vars.unregisterVarAccessor(sc.pvp)
            sc.pvp = msc.pvp
            ig.vars.registerVarAccessor('pvp', sc.pvp)

            sc.options = msc.options
            sc.combat.activeCombatants = msc.combat.activeCombatants

            /* TODO: do these observers get removed? */
            rehookObservers(msc.map, sc.map)
            removeAddon(sc.map, ig.game)
            ig.storage.listeners.erase(sc.map)
            sc.map = msc.map
            addAddon(sc.map, ig.game)

            sc.party.contacts = msc.party.contacts
            multi.server.party.createPersonalParty(this.username)

            sc.model.enterNewGame()
            if (isPhysics(multi.server)) sc.model.enterGame()
            for (const entry of ig.interact.entries) ig.interact.removeEntry(entry)

            for (const addon of ig.game.addons.teleport) addon.onTeleport(ig.game.mapName, undefined, undefined)
            for (const addon of ig.game.addons.levelLoadStart) addon.onLevelLoadStart(data)

            ig.ready = true
            // const loader = new ig.Loader()
            // loader.load()
            // ig.game.currentLoadingResource = loader

            // ig.game.loadingComplete()
            ig.game.playerEntity.onPlayerPlaced()
            ig.game.preDrawMaps()
            for (const addon of ig.game.addons.levelLoaded) addon.onLevelLoaded(ig.game)
            ig.game.handleLoadingComplete()

            initMapInteractEntries(map.inst)

            this.updateGamepadForcer()

            if (isPhysics(multi.server)) sc.model.enterGame()

            sc.Model.notifyObserver(sc.model.player.params, sc.COMBAT_PARAM_MSG.STATS_CHANGED)

            /* fix crash when opening encyclopedia */
            sc.menu.newUnlocks[sc.MENU_SUBMENU.LORE] = []

            /* this has to be linked after ig.GameAddon#onLevelLoadStart is fired since ig.Light clears it */
            ig.light.condLights = mig.light.condLights
            ig.light.condLightList = mig.light.condLightList
        })

        runTask(map.inst, () => {
            for (const client of multi.server.clients.values()) {
                if (!client.dummy) continue
                client.dummy.model.updateStats()
                sc.Model.notifyObserver(client.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
            }
        })
    }

    getSaveState(allowCopy: boolean) {
        if (!isPhysics(multi.server)) return

        let state = multi.storage.getPlayerState(this.username)
        if (allowCopy && !state && multi.server.settings.copyNewPlayerStats) {
            assert(ig.ccmap)
            const referenceClient = ig.ccmap.clients[0]
            if (referenceClient?.dummy) {
                state = multi.storage.savePlayerState(
                    referenceClient.username,
                    referenceClient.dummy,
                    referenceClient.tpInfo
                )
            }
        }
        return state
    }

    private loadState() {
        assertPhysics(multi.server)
        const state = this.getSaveState(true)
        if (state) {
            applyStateUpdatePacket({ states: { [this.dummy.netid]: state } }, 0, true)
        }
    }

    private async createPlayer() {
        if (isPhysics(multi.server)) {
            if (this.dummy && !this.dummy._killed) {
                runTask(instanceinator.instances[this.dummy._instanceId], () => {
                    this.dummy.gui.crosshair.kill(true)
                    this.dummy.kill(true)
                })
            }

            this.dummy = ig.game.spawnEntity(dummy.DummyPlayer, 0, 0, 0, {
                inputManager: this.inputManager,
                data: { username: this.username },
            })

            if (multi.server.settings.godmode) {
                ig.godmode(this.dummy.model, { circuitBranch: true })
            }

            this.loadState()
        } else {
            this.dummy =
                (this.getMap().inst.ig.game.entities.find(
                    e => e instanceof dummy.DummyPlayer && !e._killed && e.data.username == this.username
                ) as dummy.DummyPlayer | undefined) ??
                (await new Promise<dummy.DummyPlayer>(resolve => (this.playerAttachResolve = resolve)))
            this.playerAttachResolve = undefined
        }

        this.dummy.setInputManager(this.inputManager)
    }

    getMap(noAssert: true): CCMap | undefined
    getMap(noAssert?: false): CCMap
    getMap(noAssert?: any): CCMap | undefined {
        const map = multi.server.maps.get(this.tpInfo.map)
        if (!noAssert) assert(map)
        return map
    }

    destroy() {
        if (this.destroyed) return

        this.inputManager?.destroy()

        if (this.dummy) multi.storage.savePlayerState(this.username, this.dummy, this.tpInfo)

        multi.server.party.onClientDestroy(this)

        const map = multi.server.maps.get(this.tpInfo.map)
        map?.leave(this)

        multi.server.inst.apply()
        super.destroy()
    }
}

function rehookObservers(to: sc.Model, from: sc.Model) {
    const toObservers = new Set(to.observers)
    for (const fromObserver of from.observers) {
        toObservers.add(fromObserver)
    }
    to.observers = [...toObservers]
}

export function runTaskInMapInst<T>(task: () => T): T {
    if (ig.client) {
        return runTask(ig.client.getMap().inst, task)
    } else if (ig.ccmap) {
        return task()
    } else assert(false)
}
