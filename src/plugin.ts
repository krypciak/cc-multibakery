import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import ccmod from '../ccmod.json'
import { Mod1 } from 'cc-instanceinator/src/types'
import { executePostload, executePoststart, executePrestart, poststart } from './loading-stages'
import { PhysicsServer } from './server/physics/physics-server'
import { DEFAULT_HTTP_PORT } from './net/web-server'
import './multiplayer'
import './options'
import './misc/modify-prototypes'
import './tests'

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
        await executePrestart()
    }

    async postload() {
        await executePostload()
    }

    async poststart() {
        await executePoststart()
    }
}

poststart(() => {
    if (window.crossnode?.options.test) return

    if (PHYSICS && process.execPath.includes('server')) {
        multi.setServer(
            new PhysicsServer({
                globalTps: 60,
                displayServerInstance: false,
                displayMaps: true,
                displayClientInstances: true,
                displayRemoteClientInstances: true,
                forceConsistentTickTimes: false,
                attemptCrashRecovery: false,
                godmode: true,
                // save: {
                //     manualSaving: true,
                //     automaticlySave: true,
                //     loadFromSlot: 0,
                // },
                netInfo: {
                    connection: {
                        httpPort: DEFAULT_HTTP_PORT,
                        httpRoot: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/dist',
                        https: {
                            cert: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+2.pem',
                            key: '/home/krypek/home/Programming/crosscode/instances/cc-ccloader3/cc-bundler/cert/localhost+2-key.pem',
                        },
                        ccbundler: {
                            modProxy: true,
                            liveModUpdates: true,
                        },
                        type: 'socket',
                    },
                    details: {
                        title: 'dev',
                        description: 'dev server',
                        iconPath: './assets/mods/cc-multibakery/icon/icon.png',
                    },
                },
                defalutMap: {
                    // map: 'multibakery/dev',
                    map: 'rhombus-dng/room-1',
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
