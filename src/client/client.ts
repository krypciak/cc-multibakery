import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { ServerPlayer } from '../server/server-player'
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

        const inputManager = this.initInputManager()
        this.player = new ServerPlayer(this.settings.username, inputManager)

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

    async teleportInitial(mapNameOverride?: string) {
        const state = this.player.getSaveState()

        const mapName = mapNameOverride ?? state?.mapName ?? multi.server.settings.defalutMap?.map ?? 'multibakery/dev'
        const marker = state?.marker ?? multi.server.settings.defalutMap?.marker ?? 'entrance'
        await this.teleport(mapName, marker)
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        await this.player.teleport(mapName, marker)
        const map = this.player.getMap()
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

        cig.game.playerEntity = this.player.dummy

        const csc = this.inst.sc
        const msc = map.inst.sc

        rehookObservers(csc.model.player.params, this.player.dummy.model.params)
        rehookObservers(csc.model.player, this.player.dummy.model)
        csc.model.player = this.player.dummy.model
        csc.pvp = msc.pvp
        csc.options = msc.options

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
        for (const obj of this.player.getMap(true)?.onLinkChange ?? []) obj.onClientDestroy(this)

        multi.server.serverInst.apply()
        instanceinator.delete(this.inst)
    }
}

function rehookObservers(from: sc.Model, to: sc.Model) {
    to.observers.push(...from.observers)
}
