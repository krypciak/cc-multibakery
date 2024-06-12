import { CCMap } from './ccmap'
import { UpdatePacketGather } from './update-packet-gather'
import { runUpdatePacket } from './update-packet-run'

const addonRunnersFactory = () => {
    type AddonOfString<K extends string> = { [P in K]: () => void }
    type AddonMadnessBase<K extends string, T = AddonOfString<K>> = {
        onlyOnce: (new (...args: any[]) => T)[]
        ignore: (new (...args: any[]) => T)[]
        additionalDynamic: () => T[]
        key: keyof typeof ig.game.addons
    }

    const addonConfigs = {
        onPreUpdate: {
            onlyOnce: [ig.GamepadManager, sc.GlobalInput, sc.InputForcer],
            ignore: [],
            additionalDynamic() {
                return []
            },
            key: 'preUpdate',
        },
        onPostUpdate: {
            onlyOnce: [ig.ScreenBlur, sc.MenuModel, ig.Camera, ig.Rumble, sc.GlobalInput, sc.BetaControls],
            ignore: [],
            additionalDynamic() {
                return []
            },
            key: 'postUpdate',
        },
        onDeferredUpdate: {
            // prettier-ignore
            onlyOnce: [ig.GamepadManager, ig.Bgm, ig.Light, ig.Weather, ig.Overlay, ig.InteractManager, ig.EnvParticles, ig.MapSounds, sc.Detectors, sc.GameSense, ig.Gui],
            ignore: [sc.BounceSwitchGroups],
            additionalDynamic() {
                return [sc.bounceSwitchGroups]
            },
            key: 'deferredUpdate',
        },
    } as const satisfies { [K in keyof ig.GameAddon]?: AddonMadnessBase<K> }

    const runners: Record<keyof typeof addonConfigs, (ccmap: CCMap) => void> = {} as any
    for (const [funcName, config] of Object.entriesT(addonConfigs)) {
        const addons = ig.game.addons[config.key].filter(addon => !config.ignore.some(clazz => addon instanceof clazz))

        runners[funcName] = (ccmap: CCMap) => {
            const viewMap = server.server?.viewMap
            for (const addon of [
                ...addons.filter(
                    addon => !(viewMap && ccmap != viewMap && config.onlyOnce.some(filter => addon instanceof filter))
                ),
                ...config.additionalDynamic(),
            ]) {
                // @ts-expect-error
                addon[funcName]()
            }
        }
    }
    return runners
}

let addonRunners!: ReturnType<typeof addonRunnersFactory>

const updatePacketGather = new UpdatePacketGather()

ig.Game.inject({
    init() {
        this.parent()

        addonRunners = addonRunnersFactory()
    },
    update() {
        const s = server.server
        if (!s) return

        for (const map of s.getActiveMaps()) {
            map.prepareForUpdate()

            for (const func of map.scheduledFunctionsForUpdate) func()
            map.scheduledFunctionsForUpdate = []
            for (const { packet, player } of map.scheduledPacketsForUpdate) runUpdatePacket(player, packet)
            map.scheduledPacketsForUpdate = []

            addonRunners.onPreUpdate(map)

            if (this._deferredVarChanged) {
                this.varsChanged()
                this._deferredVarChanged = false
            }
            if (!this.paused && !ig.loading) {
                this.physics.update()
            }
            if (!ig.loading) this.events.update()

            addonRunners.onPostUpdate(map)

            server.sendOutUpdatePackets(updatePacketGather.pop())

            map.afterUpdate()
        }
    },
    draw() {
        const map = server?.server?.viewMap
        if (!map) return
        map.prepareForUpdate()
        this.parent()
        map.afterUpdate()
    },
    loadLevel(_data) {
        // return this.parent(data, false, false)
    },
    deferredUpdate() {
        const s = server.server
        if (!s) return

        for (const map of s.getActiveMaps()) {
            map.prepareForUpdate()

            this.deferredMapEntityUpdate()
            addonRunners.onDeferredUpdate(map)

            map.afterUpdate()
        }
    },
})
