export class Player {
    dummy: ig.dummy.DummyPlayer
    mapName: string = 'rhombus-dng.room-1'
    // isTeleporting: boolean = false

    constructor(public name: string) {
        this.dummy = new ig.dummy.DummyPlayer(0, 0, 0, { username: name })
        if (multi.server.s.godmode) ig.godmode(this.dummy.model)
    }

    // async teleport(mapName: string, marker: Nullable<string> | undefined) {
    //     this.isTeleporting = true
    //     let map = await this.getMap()
    //     map.leave(this)
    //     this.mapName = mapName
    //     map = await this.getMap()
    //     await map.enter(this)
    //     map.scheduledFunctionsForUpdate.push(() => {
    //         teleportPlayerToProperMarker(this.dummy, marker, new ig.TeleportPosition(marker))
    //         this.isTeleporting = false
    //     })
    // }
    //
    // async disconnect() {
    //     const map = await this.getMap()
    //     map.leave(this)
    //     this.dummy.kill()
    // }
}
