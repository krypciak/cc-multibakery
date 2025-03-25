import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { teleportPlayerToProperMarker } from '../teleport-fix'
import { LocalServer, waitForScheduledTask } from './local-server'
import * as inputBackup from '../dummy/dummy-input'

export class ServerPlayer {
    private destroyed: boolean = false

    dummy!: dummy.DummyPlayer
    marker: string | undefined = undefined
    ready: boolean = false

    mapInteract!: sc.MapInteract
    private dummySettings: dummy.DummyPlayer.Settings

    constructor(
        public username: string,
        public mapName: string = '',
        public inputManager: dummy.InputManager = new dummy.input.Puppet.InputManager()
    ) {
        this.dummySettings = {
            inputManager,
            data: { username },
        }
        if (!this.mapName) {
            this.mapName = 'crossedeyes/test'
            this.marker = 'entrance'
            // this.mapName = 'rhombus-dng/room-1'
        }
    }

    private createPlayer() {
        if (this.dummy) assert(this.dummy._killed)
        this.dummy = new dummy.DummyPlayer(0, 0, 0, this.dummySettings)
        // if (username.includes('luke')) {
        //     this.dummy.model.setConfig(sc.party.models['Luke'].config)
        // }

        if (multi.server.s.godmode) ig.godmode(this.dummy.model)
        // do some player data loading here
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        this.ready = false
        assert(multi.server instanceof LocalServer)
        let map = multi.server.maps[this.mapName]
        if (map && this.dummy) await map.leave(this)
        this.mapName = mapName
        map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = multi.server.maps[this.mapName]
            assert(map)
        }
        await waitForScheduledTask(map.inst, () => {
            this.createPlayer()
        })
        await map.enter(this)
        await waitForScheduledTask(map.inst, () => {
            this.mapInteract = new sc.MapInteractServerPlayer(this, map.inst.sc.mapInteract)

            teleportPlayerToProperMarker(this.dummy, marker, undefined, !marker)
            this.ready = true
        })
    }

    // async disconnect() {
    //     const map = await this.getMap()
    //     map.leave(this)
    //     this.dummy.kill()
    // }

    preUpdate() {
        this.mapInteract?.onPreUpdate()
    }

    async destroy() {
        assert(multi.server instanceof LocalServer)
        assert(!this.destroyed)
        const map = multi.server.maps[this.mapName]
        if (map) {
            await map.leave(this)
        }
        this.destroyed = true
    }
}

declare global {
    namespace sc {
        interface MapInteractServerPlayer extends sc.MapInteract {
            player: ServerPlayer
            origMapInteract: sc.MapInteract
        }
        interface MapInteractServerPlayerConstructor extends ImpactClass<MapInteractServerPlayer> {
            new (player: ServerPlayer, origMapInteract: sc.MapInteract): MapInteractServerPlayer
        }
        var MapInteractServerPlayer: MapInteractServerPlayerConstructor
    }
}
prestart(() => {
    sc.MapInteractServerPlayer = sc.MapInteract.extend({
        init(player, origMapInteract) {
            this.parent()
            this.origMapInteract = origMapInteract
            this.entries = origMapInteract.entries
            this.player = player
        },
        onPreUpdate() {
            assert(!ig.game.playerEntity)

            inputBackup.apply(this.player.inputManager)
            this.parent()
            inputBackup.restore()
        },
    })
})
