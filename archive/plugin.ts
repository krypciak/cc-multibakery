import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type {} from 'cc-determine/src/plugin'
import { Mod1 } from './types'
import { DEFAULT_PORT, Multiplayer } from './multiplayer'
import { LocalServer } from './local-server'

import 'setimmediate'

import './misc/modify-prototypes'
import './misc/entity-uuid'
// import './misc/skip-title-screen'
import './misc/godmode'
import './misc/gamepad-focus-fix'
// import './local-client'
import { startGameLoop } from './game-loop'
import { LocalClient } from './local-client'

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
        await Promise.all(prestartFunctions.sort((a, b) => a[1] - b[1]).map(([f]) => f()))

        global.multi = window.multi = new Multiplayer()
    }

    async poststart() {
        await Promise.all(poststartFunctions.sort((a, b) => a[1] - b[1]).map(([f]) => f()))

        multi.setServer(
            new LocalServer({
                name: 'example',
                slotName: 'example',
                host: 'localhost',
                port: DEFAULT_PORT,
                globalTps: 60,
                godmode: true,
                unloadInactiveMapsMs: 0 /* todo doesnt work other than 0 */,
            })
        )
        multi.nowServer = true
        startGameLoop()
        await multi.server.start()

        await multi.setClient(
            new LocalClient({
                username: 'local',
                globalTps: 60,
            })
        )
    }
}
