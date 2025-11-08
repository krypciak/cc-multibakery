import { assert } from '../misc/assert'
import { CCMap } from '../server/ccmap/ccmap'
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
            'localclient-' + settings.username,
            this.isVisible(),
            settings.forceDraw,
            inst => {
                inst.ig.client = this
            }
        )

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

    async teleport(tpInfo: MapTpInfo) {
        assert(instanceinator.id == multi.server.inst.id)
        if (this.dummy) {
            multi.storage.savePlayerState(this.dummy.data.username, this.dummy, tpInfo)
        }

        this.ready = false
        const oldMap = multi.server.maps.get(this.tpInfo.map)
        if (oldMap) {
            oldMap.leave(this)
            oldMap.forceUpdate++
            for (const obj of oldMap.onLinkChange) obj.onClientUnlink(this)
        }

        this.tpInfo = tpInfo
        this.justTeleported = true

        let map = multi.server.maps.get(this.tpInfo.map)
        if (!map) {
            await multi.server.loadMap(this.tpInfo.map)
            map = this.getMap()
        }
        await map.readyPromise

        if (oldMap) oldMap.forceUpdate--
        map.forceUpdate++
        await runTask(map.inst, () => this.createPlayer())
        map.forceUpdate--
        map.enter(this)
        runTask(map.inst, () => {
            if (multi.server instanceof PhysicsServer) {
                teleportPlayerToProperMarker(this.dummy, this.tpInfo.marker, undefined, true)
            }
            this.ready = true
        })

        await this.linkMapToInstance(map)

        this.inst.ig.game.events.clear()

        for (const obj of map.onLinkChange) obj.onClientLink(this)

        multi.storage.save()
    }

    private async linkMapToInstance(map: CCMap) {
        const cig = this.inst.ig
        const mig = map.inst.ig

        cig.game.mapName = mig.game.mapName
        cig.game.entities = mig.game.entities
        cig.game.entitiesByNetid = mig.game.entitiesByNetid
        cig.game.mapEntities = mig.game.mapEntities
        cig.game.shownEntities = mig.game.shownEntities
        cig.game.freeEntityIds = mig.game.freeEntityIds
        cig.game.namedEntities = mig.game.namedEntities
        cig.game.conditionalEntities = mig.game.conditionalEntities
        cig.game.entityTypeIdCounterMap = mig.game.entityTypeIdCounterMap

        runTask(this.inst, () => {
            ig.light.shadowProviders = []
            initMapsAndLevels.call(cig.game, map.rawLevelData)
        })

        cig.game.physics = mig.game.physics

        cig.vars = mig.vars

        cig.light.lightHandles = mig.light.lightHandles
        cig.light.darknessHandles = mig.light.darknessHandles
        cig.light.screenFlashHandles = mig.light.screenFlashHandles

        linkMusic(this.inst, map.inst)

        removeAddon(cig.screenBlur, cig.game)
        cig.screenBlur = mig.screenBlur
        addAddon(cig.screenBlur, cig.game)

        removeAddon(cig.rumble, cig.game)
        cig.rumble = mig.rumble
        addAddon(cig.rumble, cig.game)

        cig.game.playerEntity = this.dummy

        const csc = this.inst.sc
        const msc = map.inst.sc

        rehookObservers(csc.model.player.params, this.dummy.model.params)
        rehookObservers(csc.model.player, this.dummy.model)
        csc.model.player = this.dummy.model
        csc.pvp = msc.pvp
        csc.options = msc.options
        csc.combat.activeCombatants = msc.combat.activeCombatants
        csc.map = msc.map

        runTask(this.inst, () => {
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
        })

        /* this has to be linked after ig.GameAddon#onLevelLoadStart is fired since ig.Light clears it */
        cig.light.condLights = mig.light.condLights
        cig.light.condLightList = mig.light.condLightList

        runTask(map.inst, () => {
            for (const client of multi.server.clients.values()) {
                client.dummy.model.updateStats()
                sc.Model.notifyObserver(client.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
            }
            this.dummy.party = addCombatantParty(`player${this.inst.id}`)
        })
    }

    getSaveState() {
        return multi.storage.getPlayerState(this.username)
    }

    private loadState() {
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

function rehookObservers(from: sc.Model, to: sc.Model) {
    const toObservers = new Set(to.observers)
    for (const fromObserver of from.observers) {
        toObservers.add(fromObserver)
    }
    to.observers = [...toObservers]
}
