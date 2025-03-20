import { assert } from '../misc/assert'
import { teleportPlayerToProperMarker } from '../teleport-fix'
import { LocalServer, waitForScheduledTask } from './local-server'
import { indent } from './local-server-console'

export class ServerPlayer {
    dummy: dummy.DummyPlayer
    marker: string | undefined = undefined
    ready: boolean = false

    constructor(
        public username: string,
        public mapName: string = '',
        inputManager: dummy.InputManager = new dummy.inputManagers.Puppet.InputManager()
    ) {
        this.dummy = new dummy.DummyPlayer(0, 0, 0, { inputManager, data: { username } })
        if (multi.server.s.godmode) ig.godmode(this.dummy.model)
        // do some player data loading here
        if (!this.mapName) {
            this.mapName = 'rhombus-dng/room-1'
        }
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        this.ready = false
        assert(multi.server instanceof LocalServer)
        let map = multi.server.maps[this.mapName]
        if (map) await map.leave(this)
        this.mapName = mapName
        map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = multi.server.maps[this.mapName]
            assert(map)
        }
        await map.enter(this)
        await waitForScheduledTask(map.inst, () => {
            teleportPlayerToProperMarker(this.dummy, marker, undefined, !marker)
            this.ready = true
        })
    }

    // async disconnect() {
    //     const map = await this.getMap()
    //     map.leave(this)
    //     this.dummy.kill()
    // }

    toConsoleString(i: number = 0): string {
        let str = ''
        str += indent(i) + `player { name: ${this.username}; map: ${this.mapName} }\n`
        return str
    }
}
