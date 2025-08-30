import { assert } from '../misc/assert'
import { prestart } from '../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from './physics/physics-server'
import { teleportPlayerToProperMarker } from './ccmap/teleport-fix'
import { Client } from '../client/client'
import { CCMap } from './ccmap/ccmap'
import { inputBackup } from '../dummy/dummy-input'
import { applyStateUpdatePacket } from '../state/states'

export class ServerPlayer {
    private destroyed: boolean = false

    dummy!: dummy.DummyPlayer
    mapName: string = ''
    marker?: Nullable<string>
    ready: boolean = false

    mapInteract!: multi.class.ServerPlayer.MapInteract

    constructor(
        public username: string,
        public inputManager: dummy.InputManager = new dummy.input.Puppet.InputManager()
    ) {}

    getSaveState() {
        return multi.storage.getPlayerState(this.username)
    }

    private loadState() {
        const state = this.getSaveState()
        if (state) {
            applyStateUpdatePacket({ states: { [this.dummy.netid]: state } }, 0, true)
        }
    }

    private createPlayer() {
        if (this.dummy) assert(this.dummy._killed)

        const dummySettings: dummy.DummyPlayer.Settings = {
            inputManager: this.inputManager,
            data: { username: this.username },
        }

        this.dummy = ig.game.spawnEntity(dummy.DummyPlayer, 0, 0, 0, dummySettings)
        // if (username.includes('luke')) {
        //     this.dummy.model.setConfig(sc.party.models['Luke'].config)
        // }

        if (multi.server instanceof PhysicsServer && multi.server.settings.godmode) ig.godmode(this.dummy.model)

        this.loadState()
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
        let map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = this.getMap()
        }
        await map.readyPromise

        if (oldMap) oldMap.forceUpdate--
        map.forceUpdate++
        runTask(map.inst, () => {
            this.createPlayer()
        })
        map.forceUpdate--
        map.enter(this)
        runTask(map.inst, () => {
            this.mapInteract = new multi.class.ServerPlayer.MapInteract(this, map.inst.sc.mapInteract)

            if (multi.server instanceof PhysicsServer) {
                teleportPlayerToProperMarker(this.dummy, marker, undefined, true)
            }
            this.ready = true
        })
    }

    update() {
        this.mapInteract?.onPreUpdate()
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
        multi.storage.savePlayerState(this.dummy.data.username, this.dummy, this.mapName, this.marker)

        assert(!this.destroyed)
        const map = multi.server.maps[this.mapName]
        map?.leave(this)
        this.destroyed = true
    }
}

prestart(() => {
    multi.class.ServerPlayer = {} as any
}, 1)
declare global {
    namespace multi.class.ServerPlayer {
        interface MapInteract extends sc.MapInteract {
            player: ServerPlayer
            origMapInteract: sc.MapInteract
        }
        interface MapInteractConstructor extends ImpactClass<MapInteract> {
            new (player: ServerPlayer, origMapInteract: sc.MapInteract): MapInteract
        }
        var MapInteract: MapInteractConstructor
    }
}
prestart(() => {
    multi.class.ServerPlayer.MapInteract = sc.MapInteract.extend({
        init(player, origMapInteract) {
            this.parent()
            this.origMapInteract = origMapInteract
            this.entries = origMapInteract.entries
            this.player = player
        },
        onPreUpdate() {
            assert(!ig.game.playerEntity)

            inputBackup(this.player.inputManager, () => this.parent())
        },
    })
})
