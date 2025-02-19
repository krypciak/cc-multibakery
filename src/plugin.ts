import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Mod1 } from 'cc-determine/src/types'
import { DEFAULT_PORT, Multiplayer } from './multiplayer'
import './misc/modify-prototypes'
import { LocalServer } from './server/local-server'

let prestartFunctions: [() => void | Promise<void>, number][]
export function prestart(func: () => void | Promise<void>, priority: number = 100) {
    prestartFunctions ??= []
    prestartFunctions.push([func, priority])
}

let poststartFunctions: [() => void | Promise<void>, number][]
export function poststart(func: () => void | Promise<void>, priority: number = 100) {
    poststartFunctions ??= []
    poststartFunctions.push([func, priority])
}

export default class Multibakery implements PluginClass {
    static dir: string
    static mod: Mod1

    constructor(mod: Mod1) {
        Multibakery.dir = mod.baseDirectory
        Multibakery.mod = mod
        Multibakery.mod.isCCL3 = mod.findAllAssets ? true : false
        Multibakery.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
        if (!Multibakery.mod.isCCL3) Object.assign(mod, { id: Multibakery.mod.name })
    }

    async prestart() {
        if (window.crossnode?.options.test) {
            // await import('./test/aoc2024d15')
        }
        global.multi = window.multi = new Multiplayer()

        await Promise.all((prestartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
    }

    async poststart() {
        await Promise.all((poststartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))

        multi.setServer(
            new LocalServer({
                name: 'example',
                slotName: 'example',
                host: 'localhost',
                port: DEFAULT_PORT,
                globalTps: 60,
                godmode: true,
                displayMaps: true,
            })
        )
        multi.server.start()
    }
}
