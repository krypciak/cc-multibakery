import { assert } from '../misc/assert'
import { CCMap, linkTimersModel } from '../server/ccmap/ccmap'
import { addAddon, removeAddon } from '../dummy/box/box-addon'
import { clearForceGamepad, forceGamepad } from './force-gamepad'
import { initMapInteractEntries } from './map-interact'
import { runTask } from 'cc-instanceinator/src/inst-util'
import {
    createClientConnectionInfoLabel,
    createClientNetworkPacketTrafficLabel,
    createClientPingLabel,
} from './client-label-draw'
import { RemoteServer } from '../server/remote/remote-server'
import { isUsernameValid } from '../misc/username-util'
import { addCombatantParty } from '../misc/combatant-party-api'
import { applyStateUpdatePacket } from '../state/states'
import { PhysicsServer } from '../server/physics/physics-server'
import { teleportPlayerToProperMarker } from '../server/ccmap/teleport-fix'
import { InstanceUpdateable } from '../server/instance-updateable'
import { updateDummyData } from './injects'
import { initMapsAndLevels } from '../server/ccmap/data-load'
import { linkMusic } from '../server/music'
import { MapTpInfo } from '../server/server'

import './injects'

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

    username: string
    inputManager!: dummy.InputManager
    dummy!: dummy.DummyPlayer
    tpInfo: MapTpInfo = { map: '' }
    nextTpInfo: MapTpInfo = { map: '' }
    ready: boolean = false
    justTeleported: boolean = false
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

        if (multi.server instanceof RemoteServer) {
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
            forceGamepad(this)
        } else {
            clearForceGamepad(this)
        }
    }

    async teleportInitial(tpInfoOverride?: MapTpInfo) {
        const state = this.getSaveState()

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
            multi.storage.savePlayerState(this.dummy.data.username, this.dummy, tpInfo)
        }

        this.nextTpInfo = tpInfo
        this.justTeleported = true

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
            for (const obj of oldMap.onLinkChange) obj.onClientUnlink(this)
        }

        this.tpInfo = tpInfo

        await runTask(map.inst, () => this.createPlayer())
        map.enter(this)

        runTask(map.inst, () => {
            if (multi.server instanceof PhysicsServer) {
                teleportPlayerToProperMarker(this.dummy, this.tpInfo.marker, undefined, true)
            }
        })
        this.ready = true

        this.linkMapToInstance(map)

        this.inst.ig.game.events.clear()

        for (const obj of map.onLinkChange) obj.onClientLink(this)

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
            ig.game.entityTypeIdCounterMap = mig.game.entityTypeIdCounterMap

            ig.light.shadowProviders = []
            initMapsAndLevels.call(ig.game, map.rawLevelData)

            ig.game.physics = mig.game.physics

            ig.vars = mig.vars

            ig.light.lightHandles = mig.light.lightHandles
            ig.light.darknessHandles = mig.light.darknessHandles
            ig.light.screenFlashHandles = mig.light.screenFlashHandles

            linkMusic(this.inst, map.inst)
            linkTimersModel(this.inst, map.inst)

            removeAddon(ig.screenBlur, ig.game)
            ig.screenBlur = mig.screenBlur
            addAddon(ig.screenBlur, ig.game)

            removeAddon(ig.rumble, ig.game)
            ig.rumble = mig.rumble
            addAddon(ig.rumble, ig.game)

            ig.game.playerEntity = this.dummy

            const msc = map.inst.sc

            rehookObservers(this.dummy.model.params, sc.model.player.params)
            rehookObservers(this.dummy.model, sc.model.player)
            sc.model.player = this.dummy.model
            sc.pvp = msc.pvp
            sc.options = msc.options
            sc.combat.activeCombatants = msc.combat.activeCombatants

            /* TODO: do these observers get removed? */
            rehookObservers(msc.map, sc.map)
            removeAddon(sc.map, ig.game)
            ig.storage.listeners.erase(sc.map)
            sc.map = msc.map
            addAddon(sc.map, ig.game)

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
            ig.game.playerEntity.onPlayerPlaced()

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
            this.dummy.party = addCombatantParty(`player${this.inst.id}`)
        })
    }

    getSaveState() {
        if (!(multi.server instanceof PhysicsServer)) return

        let state = multi.storage.getPlayerState(this.username)
        if (!state && multi.server.settings.copyNewPlayerStats) {
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
        assert(multi.server instanceof PhysicsServer)
        const state = this.getSaveState()
        if (state) {
            applyStateUpdatePacket({ states: { [this.dummy.netid]: state } }, 0, true)
        }
    }

    private async createPlayer() {
        if (multi.server instanceof PhysicsServer) {
            if (this.dummy && !this.dummy._killed) {
                runTask(instanceinator.instances[this.dummy._instanceId], () => {
                    this.dummy.gui.crosshair.kill(true)
                    this.dummy.kill(true)
                })
            }

            this.inputManager?.destroy()

            const dummySettings: dummy.DummyPlayer.Settings = {
                inputManager: this.inputManager,
                data: { username: this.username },
            }
            this.dummy = ig.game.spawnEntity(dummy.DummyPlayer, 0, 0, 0, dummySettings)

            if (multi.server.settings.godmode) {
                ig.godmode(this.dummy.model)
                runTask(this.inst, () => ig.godmode(this.dummy.model, { circuitBranch: true }))
            }

            this.loadState()
        } else {
            const player =
                (this.getMap().inst.ig.game.entities.find(
                    e => e instanceof dummy.DummyPlayer && !e._killed && e.data.username == this.username
                ) as dummy.DummyPlayer | undefined) ??
                (await new Promise<dummy.DummyPlayer>(resolve => (this.playerAttachResolve = resolve)))
            this.playerAttachResolve = undefined

            this.dummy = this.inputManager.player = player
            player.inputManager = this.inputManager
        }
    }

    getClient(noAssert: true): Client | undefined
    getClient(noAssert?: false): Client
    getClient(noAssert?: any): Client | undefined {
        return this.dummy.getClient(noAssert)
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

        if (this.dummy) multi.storage.savePlayerState(this.dummy.data.username, this.dummy, this.tpInfo)

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
