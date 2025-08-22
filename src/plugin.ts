import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import ccmod from '../ccmod.json'
import { Mod1 } from 'cc-instanceinator/src/types'
import { PhysicsServer } from './server/physics/physics-server'
import { DEFAULT_HTTP_PORT } from './net/web-server'
import './multiplayer'
import './options'
import './misc/modify-prototypes'
import './tests'

let postloadFunctions: [() => void | Promise<void>, number][]
export function postload(func: () => void | Promise<void>, priority: number = 100) {
    postloadFunctions ??= []
    postloadFunctions.push([func, priority])
}

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
    static manifset: typeof import('../ccmod.json') = ccmod

    constructor(mod: Mod1) {
        Multibakery.dir = mod.baseDirectory
        Multibakery.mod = mod
        Multibakery.mod.isCCL3 = mod.findAllAssets ? true : false
        Multibakery.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
        if (!Multibakery.mod.isCCL3) Object.assign(mod, { id: Multibakery.mod.name })
    }

    async prestart() {
        await Promise.all((prestartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
    }

    async postload() {
        await Promise.all((postloadFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
    }

    async poststart() {
        await Promise.all((poststartFunctions ?? []).sort((a, b) => a[1] - b[1]).map(([f]) => f()))
    }
}

poststart(() => {
    if (window.crossnode?.options.test) return

    // TODO: fix duplicate inputs on high latency devices
    // TODO: fix input field popup not showing on browser

    if (PHYSICS && process.execPath.includes('server')) {
        multi.setServer(
            new PhysicsServer({
                globalTps: 60,
                godmode: true,
                displayServerInstance: false,
                displayMaps: true,
                displayClientInstances: true,
                displayRemoteClientInstances: true,
                forceConsistentTickTimes: false,
                attemptCrashRecovery: false,
                netInfo: {
                    connection: {
                        httpPort: DEFAULT_HTTP_PORT,
                        httpRoot: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/dist',
                        https: {
                            cert: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+2.pem',
                            key: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+2-key.pem',
                        },
                        ccbundler: true,
                        type: 'socket',
                    },
                    details: {
                        title: 'dev',
                        description: 'dev server',
                        iconPath: './assets/mods/cc-multibakery/icon/icon.png',
                    },
                },
                defalutMap: {
                    map: 'multibakery/dev',
                    // map: 'rhombus-dng/room-1',
                    // marker: 'entrance',
                    // marker: 'puzzle',
                    marker: 'pvp',
                },
            })
        )
        multi.server.start()
    } else if (REMOTE && process.execPath.includes('client')) {
        return
    }
}, 999)
