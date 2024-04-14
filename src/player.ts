import { CCMap } from './ccmap'
import { teleportPlayerToProperMarker } from './teleport-fix'

export class Player {
    static async new(name: string): Promise<Player> {
        return new Player(name, ig.multiplayer.server.currentMapViewName)
    }

    dummy: ig.dummy.DummyPlayer
    isTeleporting: boolean = false

    private constructor(
        public name: string,
        public mapName: string
    ) {
        this.dummy = new ig.dummy.DummyPlayer(0, 0, 0, { username: name })
        if (ig.multiplayer.server.s.godmode) ig.godmode(this.dummy.model)
        this.afterTeleport()
    }

    async getMap(): Promise<CCMap> {
        return ig.multiplayer.server.getMap(this.mapName)
    }

    async teleport(mapName: string, marker: Nullable<string> | undefined) {
        this.isTeleporting = true
        let map = await this.getMap()
        map.leave(this)
        this.mapName = mapName
        map = await this.getMap()
        await map.enter(this)
        map.scheduledFunctionsForUpdate.push(() => {
            teleportPlayerToProperMarker(this.dummy, marker, new ig.TeleportPosition(marker))
            this.afterTeleport()
            this.isTeleporting = false
        })
    }

    private afterTeleport() {
        this.dummy.hideUsernameBox()
        if (ig.multiplayer.server.currentMapViewName == this.mapName) {
            this.dummy.showUsernameBox()
        }
    }

    async disconnect() {
        const map = await this.getMap()
        map.leave(this)
        this.dummy.kill()
    }
}
