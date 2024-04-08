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
const addonDeferredUpdateFiler: any[] = [ig.GamepadManager, ig.Bgm, ig.Light, ig.Weather, ig.Overlay, ig.InteractManager, ig.EnvParticles, ig.MapSounds, sc.Detectors, sc.GameSense]

const updatePacketGather = new UpdatePacketGather()

ig.Game.inject({
    update() {
        const s = ig.multiplayer.server
        if (!s) return

        if (this.playerEntity) this.playerEntity.coll.ignoreCollision = true

        for (const map of Object.values(s.maps)) {
            map.prepareForUpdate()

            for (const { packet, player } of map.scheduledForUpdate) runUpdatePacket(player, packet)
            map.scheduledForUpdate = []

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
    teleport(mapName, marker, hint, clearCache, reloadCache) {
        console.log('teleport: ', mapName, marker, hint, clearCache, reloadCache)
    },
    loadLevel(_data) {
        // return this.parent(data, false, false)
    },
    prepareNewLevelView(path) {
        ig.multiplayer.server.currentMapViewName = path

        /* set the viewer skin to junolea, wont crash if the junolea skin isnt installed */
        sc.playerSkins.currentSkins['Appearance'] = sc.playerSkins._createSkin('junolea')

        const map = ig.multiplayer.server.viewMap
        map.prepareForUpdate()

        ig.imageAtlas.defragment()
        ig.ready = false

        this.createPlayer()
        if (this.playerEntity) {
            for (const e of this.shownEntities) {
                if ('applyMarkerPosition' in e && typeof e.applyMarkerPosition === 'function') {
                    e.applyMarkerPosition(this.playerEntity)
                    break
                }
            }
        }

        ig.ready = true

        const loader = new (this.mapLoader || ig.Loader)()
        loader.load()
        this.currentLoadingResource = loader

        map.afterUpdate()
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
