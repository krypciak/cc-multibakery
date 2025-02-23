import { assert } from '../misc/assert'
import { teleportPlayerToProperMarker } from '../teleport-fix'
import { LocalServer, waitForScheduledTask } from './local-server'
import { indent } from './local-server-console'

export class Player {
    dummy: dummy.DummyPlayer
    mapName: string = ''
    isTeleporting: boolean = false

    constructor(public name: string) {
        this.dummy = new dummy.DummyPlayer(0, 0, 0, { username: name })
        if (multi.server.s.godmode) ig.godmode(this.dummy.model)
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        this.isTeleporting = true
        assert(multi.server instanceof LocalServer)
        if (this.mapName) {
            const map = multi.server.maps[this.mapName]
            assert(map)
            await map.leave(this)
        }
        this.mapName = mapName
        let map = multi.server.maps[this.mapName]
        if (!map) {
            await multi.server.loadMap(this.mapName)
            map = multi.server.maps[this.mapName]
            assert(map)
        }
        await map.enter(this)
        await waitForScheduledTask(map.inst, () => {
            teleportPlayerToProperMarker(this.dummy, marker, undefined, !marker)
            this.isTeleporting = false
        })
    }

    // async disconnect() {
    //     const map = await this.getMap()
    //     map.leave(this)
    //     this.dummy.kill()
    // }

    toConsoleString(i: number = 0): string {
        let str = ''
        str += indent(i) + `player { name: ${this.name}; map: ${this.mapName} }\n`
        return str
    }
}
