import { assert } from '../misc/assert'
import { prestart } from '../plugin'
import { scheduleTask } from 'cc-instanceinator/src/inst-util'
import * as inputBackup from '../dummy/dummy-input'
import { PhysicsServer } from './physics/physics-server'
import { teleportPlayerToProperMarker } from './ccmap/teleport-fix'
import { Client } from '../client/client'
import { CCMap } from './ccmap/ccmap'

export class ServerPlayer {
    private destroyed: boolean = false

    dummy!: dummy.DummyPlayer
    mapName: string = ''
    marker: string | undefined = undefined
    ready: boolean = false

    mapInteract!: multi.class.ServerPlayer.MapInteract

    constructor(
        public username: string,
        public inputManager: dummy.InputManager = new dummy.input.Puppet.InputManager(),
        private attachDummy: boolean = false
    ) {}

    private async createPlayer() {
        if (this.dummy) assert(this.dummy._killed)

        const dummySettings: dummy.DummyPlayer.Settings = {
            inputManager: this.inputManager,
            data: { username: this.username },
        }

        if (this.attachDummy) {
            const netid = dummy.DummyPlayer.prototype.createNetid.call({} as any, 0, 0, 0, dummySettings)

            this.dummy = await new Promise<dummy.DummyPlayer>(resolve => {
                const func = () => {
                    const entity = ig.game.entitiesByNetid[netid]
                    if (entity) {
                        assert(entity instanceof dummy.DummyPlayer)
                        resolve(entity)
                    } else {
                        ig.game.nextScheduledTasks.push(func)
                    }
                }
                func()
            })
            this.inputManager.player = this.dummy
            this.dummy.inputManager = this.inputManager
        } else {
            this.dummy = ig.game.spawnEntity(dummy.DummyPlayer, 0, 0, 0, dummySettings)
        }
        // if (username.includes('luke')) {
        //     this.dummy.model.setConfig(sc.party.models['Luke'].config)
        // }

        if (multi.server instanceof PhysicsServer && multi.server.settings.godmode) ig.godmode(this.dummy.model)
        // do some player data loading here
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        assert(instanceinator.id == multi.server.serverInst.id)
        this.ready = false
        let map = multi.server.maps[this.mapName]
        if (map && this.dummy) map.leave(this)
        this.mapName = mapName
        map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = this.getMap()
        }
        await map.readyPromise
        await scheduleTask(map.inst, async () => {
            await this.createPlayer()
        })
        await map.enter(this)
        await scheduleTask(map.inst, () => {
            this.mapInteract = new multi.class.ServerPlayer.MapInteract(this, map.inst.sc.mapInteract)

            teleportPlayerToProperMarker(this.dummy, marker, undefined, true)
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

    getMap(): CCMap {
        const map = multi.server.maps[this.mapName]
        assert(map)
        return map
    }

    destroy() {
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

            inputBackup.apply(this.player.inputManager)
            this.parent()
            inputBackup.restore()
        },
    })
})
