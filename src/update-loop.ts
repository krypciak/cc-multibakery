import { CCMap } from './ccmap'
import { UpdatePacketGather } from './update-packet-gather'
import { runUpdatePacket } from './update-packet-run'

function runFilteredAddons(map: CCMap, addons: any[], func: string, filterList: any[]) {
    const viewMap = ig.multiplayer?.server?.viewMap
    for (const addon of addons) {
        if (viewMap && map != viewMap && filterList.some(filter => addon instanceof filter)) {
            continue
        }
        addon[func]()
    }
}

const addonPreUpdateFilter: any[] = [ig.GamepadManager, sc.GlobalInput, sc.InputForcer]
// @ts-expect-error
// prettier-ignore
const addonPostUpdateFilter: any[] = [ig.ScreenBlur, sc.MenuModel, ig.Camera, ig.Rumble, sc.GlobalInput, sc.BetaControls]
// @ts-expect-error
// prettier-ignore
const addonDeferredUpdateFiler: any[] = [ig.GamepadManager, ig.Bgm, ig.Light, ig.Weather, ig.Overlay, ig.InteractManager, ig.EnvParticles, ig.MapSounds, sc.Detectors, sc.GameSense, ig.Gui]

const updatePacketGather = new UpdatePacketGather()

ig.Game.inject({
    update() {
        const s = ig.multiplayer.server
        if (!s) return

        for (const map of Object.values(s.maps)) {
            if (map.players.length == 0 && ig.multiplayer.server.currentMapViewName != map.mapName) continue
            map.prepareForUpdate()

            for (const func of map.scheduledFunctionsForUpdate) func()
            map.scheduledFunctionsForUpdate = []
            for (const { packet, player } of map.scheduledPacketsForUpdate) runUpdatePacket(player, packet)
            map.scheduledPacketsForUpdate = []

            runFilteredAddons(map, this.addons.preUpdate, 'onPreUpdate', addonPreUpdateFilter)

            if (this._deferredVarChanged) {
                this.varsChanged()
                this._deferredVarChanged = false
            }
            if (!this.paused && !ig.loading) {
                this.physics.update()
            }
            ig.loading || this.events.update()
            runFilteredAddons(map, this.addons.postUpdate, 'onPostUpdate', addonPostUpdateFilter)

            ig.multiplayer.sendOutUpdatePackets(updatePacketGather.pop())

            map.afterUpdate()
        }
    },
    draw() {
        const map = ig.multiplayer?.server?.viewMap
        if (!map) return
        map.prepareForUpdate()
        this.parent()
        map.afterUpdate()
    },
    loadLevel(_data) {
        // return this.parent(data, false, false)
    },
    deferredUpdate() {
        const s = ig.multiplayer.server
        if (!s) return
        const orig = ig.system.tick

        for (const map of Object.values(s.maps)) {
            map.prepareForUpdate()

            this.deferredMapEntityUpdate()
            runFilteredAddons(map, this.addons.deferredUpdate, 'onDeferredUpdate', addonDeferredUpdateFiler)

            map.afterUpdate()
        }

        if (ig.system.tick != orig) console.log('diff')
    },
})
