import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Mod1 } from 'cc-determine/src/types'
import { initMultiplayer } from './multiplayer'
import { DEFAULT_SOCKETIO_PORT } from './net/socket'
import { PhysicsServer } from './server/physics-server'
import './misc/modify-prototypes'
import { RemoteServer } from './server/remote-server'

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
            await import('./server/test/aoc2024d15')
            // await import('./server/test/mouse-simple')
        }
        global.multi = window.multi = initMultiplayer()

        await Promise.all((prestartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
    }

    async poststart() {
        await Promise.all((poststartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))

        if (window.crossnode?.options.test) return

        if (process.execPath.includes('server')) {
            multi.setServer(
                new PhysicsServer({
                    name: 'example',
                    slotName: 'example',
                    globalTps: 60,
                    godmode: true,
                    displayServerInstance: false,
                    displayMaps: true,
                    displayLocalClientMaps: true,
                    forceConsistentTickTimes: false,
                    socketSettings: {
                        port: DEFAULT_SOCKETIO_PORT,
                    },
                })
            )
            multi.server.start()
        } else if (process.execPath.includes('client')) {
            multi.setServer(
                new RemoteServer({
                    globalTps: 60,
                    displayServerInstance: false,
                    displayMaps: false,
                    displayLocalClientMaps: true,
                    forceConsistentTickTimes: false,
                    socketSettings: {
                        host: '127.0.0.1',
                        port: DEFAULT_SOCKETIO_PORT,
                    },
                })
            )
            multi.server.start()
        }
    }
}
