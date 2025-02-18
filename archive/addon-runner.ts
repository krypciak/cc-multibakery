import { CCMap } from './ccmap'
import { assert } from './misc/assert'
import { poststart } from './plugin'

const addonRunnersFactory = () => {
    type AddonOfString<K extends string> = { [P in K]: () => void }
    type AddonMadnessBase<K extends string, T = AddonOfString<K>> = {
        client: (new (...args: any[]) => T)[]
        ignore: (new (...args: any[]) => T)[]
        additionalDynamic: () => T[]
        key: keyof typeof ig.game.addons
    }

    const addonConfigs = {
        onPreUpdate: {
            client: [ig.GamepadManager, sc.GlobalInput, sc.InputForcer],
            ignore: [],
            additionalDynamic() {
                return []
            },
            key: 'preUpdate',
        },
        onPostUpdate: {
            client: [ig.ScreenBlur, sc.MenuModel, ig.Camera, ig.Rumble, sc.GlobalInput, sc.BetaControls],
            ignore: [],
            additionalDynamic() {
                return []
            },
            key: 'postUpdate',
        },
        onDeferredUpdate: {
            // prettier-ignore
            client: [ig.GamepadManager, ig.Bgm, ig.Light, ig.Weather, ig.Overlay, ig.InteractManager, ig.EnvParticles, ig.MapSounds, sc.Detectors, sc.GameSense, ig.Gui],
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

        // could be optimalized performance-wise
        runners[funcName] = (_ccmap: CCMap) => {
            assert(multi.nowServer)
            for (const addon of [
                ...addons.filter(addon => !config.client.some(filter => addon instanceof filter)),
                ...config.additionalDynamic(),
            ]) {
                // @ts-expect-error
                addon[funcName]()
            }
        }
    }
    return runners
}
export let addonRunners!: ReturnType<typeof addonRunnersFactory>
poststart(() => {
    addonRunners = addonRunnersFactory()
})
