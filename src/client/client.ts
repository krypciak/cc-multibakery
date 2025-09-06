import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import { CCMap } from '../server/ccmap/ccmap'
import { addAddon, removeAddon } from '../dummy/dummy-box-addon'
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

import './injects'
import { GameLoopUpdateable } from '../server/server'
import { applyStateUpdatePacket } from '../state/states'
import { PhysicsServer } from '../server/physics/physics-server'
import { teleportPlayerToProperMarker } from '../server/ccmap/teleport-fix'
import { createDummyNetid } from '../state/entity/dummy_DummyPlayer'

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

export class Client implements GameLoopUpdateable {
    inst!: InstanceinatorInstance

    private destroyed: boolean = false

    lastPingMs: number = 0

    username: string
    inputManager!: dummy.InputManager
    dummy!: dummy.DummyPlayer
    mapName: string = ''
    marker?: Nullable<string>
    ready: boolean = false
    justTeleported: boolean = false

    static async create(settings: ClientSettings): Promise<Client> {
        const client = new Client(settings)
        await client.init(settings)
        return client
    }

    private constructor(public settings: ClientSettings) {
        assert(isUsernameValid(settings.username))
        this.username = settings.username
    }

    private async init(settings: ClientSettings) {
        this.inst = await instanceinator.copy(
            multi.server.baseInst,
            'localclient-' + settings.username,
            this.isVisible(),
            settings.forceDraw,
            inst => {
                inst.ig.client = this
            }
        )

        this.inputManager = this.initInputManager()

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
        if (this.inputManager instanceof dummy.input.Puppet.InputManager) return

        if (this.inputManager.inputType == ig.INPUT_DEVICES.GAMEPAD) {
            forceGamepad(this)
        } else {
            clearForceGamepad(this)
        }
    }

    async teleportInitial(mapNameOverride?: string) {
        const state = this.getSaveState()

        const mapName = mapNameOverride ?? state?.mapName ?? multi.server.settings.defalutMap?.map ?? 'multibakery/dev'
        const marker = state?.marker ?? multi.server.settings.defalutMap?.marker ?? 'entrance'
        await this.teleport(mapName, marker)
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        assert(instanceinator.id == multi.server.serverInst.id)
        if (this.dummy) {
            multi.storage.savePlayerState(this.dummy.data.username, this.dummy, mapName, marker)
        }

        this.ready = false
        const oldMap = multi.server.maps[this.mapName]
        if (oldMap && this.dummy) oldMap.leave(this)
        if (oldMap) oldMap.forceUpdate++

        this.mapName = mapName
        this.marker = marker
        this.justTeleported = true

        let map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = this.getMap()
        }
        await map.readyPromise

        if (oldMap) oldMap.forceUpdate--
        map.forceUpdate++
        runTask(map.inst, () => {
            this.createPlayer(Vec3.create())
        })
        map.forceUpdate--
        map.enter(this)
        runTask(map.inst, () => {
            if (multi.server instanceof PhysicsServer) {
                teleportPlayerToProperMarker(this.dummy, marker, undefined, true)
            }
            this.ready = true
        })

        await this.linkMapToInstance(map)

        for (const obj of map.onLinkChange) obj.onClientLink(this)

        multi.storage.save()
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

        cig.game.playerEntity = this.dummy

        const csc = this.inst.sc
        const msc = map.inst.sc

        rehookObservers(csc.model.player.params, this.dummy.model.params)
        rehookObservers(csc.model.player, this.dummy.model)
        csc.model.player = this.dummy.model
        csc.pvp = msc.pvp
        csc.options = msc.options
        csc.combat.activeCombatants = msc.combat.activeCombatants

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

            /* fix crash when opening encyclopedia */
            sc.menu.newUnlocks[sc.MENU_SUBMENU.LORE] = []
        })

        runTask(map.inst, () => {
            for (const client of Object.values(multi.server.clients)) {
                if (client instanceof Client) {
                    client.dummy.model.updateStats()
                    sc.Model.notifyObserver(client.dummy.model, sc.PLAYER_MSG.LEVEL_CHANGE)
                }
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

    createPlayer(pos: Vec3) {
        if (this.dummy && !this.dummy._killed) {
            this.dummy.gui.crosshair.kill(true)
            this.dummy.kill(true)
        }
        if (multi.server instanceof PhysicsServer && this.dummy) assert(this.dummy._killed)

        const dummySettings: dummy.DummyPlayer.Settings = {
            inputManager: this.inputManager,
            data: { username: this.username },
        }

        const netid = createDummyNetid(this.username)
        if (multi.server instanceof RemoteServer && ig.game.entitiesByNetid[netid]) {
            const entity = ig.game.entitiesByNetid[netid]
            assert(entity instanceof dummy.DummyPlayer)
            this.dummy = entity
        } else {
            this.dummy = ig.game.spawnEntity(dummy.DummyPlayer, pos.x, pos.y, pos.z, dummySettings)
        }
        // if (username.includes('luke')) {
        //     this.dummy.model.setConfig(sc.party.models['Luke'].config)
        // }

        if (multi.server instanceof PhysicsServer && multi.server.settings.godmode) {
            ig.godmode(this.dummy.model)
            runTask(this.inst, () => ig.godmode(this.dummy.model))
        }

        this.loadState()
    }

    getClient(noAssert: true): Client | undefined
    getClient(noAssert?: false): Client
    getClient(noAssert?: any): Client | undefined {
        return this.dummy.getClient(noAssert)
    }

    getMap(noAssert: true): CCMap | undefined
    getMap(noAssert?: false): CCMap
    getMap(noAssert?: any): CCMap | undefined {
        const map = multi.server.maps[this.mapName]
        if (!noAssert) assert(map)
        return map
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true
        this.inst.ig.gamepad.destroy?.()

        multi.storage.savePlayerState(this.dummy.data.username, this.dummy, this.mapName, this.marker)

        const map = multi.server.maps[this.mapName]
        map?.leave(this)

        for (const obj of map?.onLinkChange ?? []) obj.onClientDestroy(this)

        multi.server.serverInst.apply()
        instanceinator.delete(this.inst)
    }
}

function rehookObservers(from: sc.Model, to: sc.Model) {
    const toObservers = new Set(to.observers)
    for (const fromObserver of from.observers) {
        toObservers.add(fromObserver)
    }
    to.observers = [...toObservers]
}
