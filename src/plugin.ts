import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Mod1 } from './types'
import { DEFAULT_PORT, Multiplayer } from './multiplayer'
import { CCServer } from './server'

import 'setimmediate'

export default class CCMultiplayerServer implements PluginClass {
    static dir: string
    static mod: Mod1

    constructor(mod: Mod1) {
        CCMultiplayerServer.dir = mod.baseDirectory
        CCMultiplayerServer.mod = mod
        CCMultiplayerServer.mod.isCCL3 = mod.findAllAssets ? true : false
        CCMultiplayerServer.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    async prestart() {
        await import('./misc/modify-prototypes')
        await import('./misc/entity-uuid')
        await import('./misc/skip-title-screen')
        await import('./misc/godmode')
        ig.multiplayer = new Multiplayer()
    }

    async poststart() {
        new CCServer({
            name: 'example',
            slotName: 'example',
            host: 'localhost',
            port: DEFAULT_PORT,
            globalTps: 60,
            rollback: false,
            clientStateCorrection: {
                posTickInterval: 3,
            },
            godmode: true,
            unloadInactiveMapsMs: 0 /* todo doesnt work other than 0 */,
        })

        ig.multiplayer.start()
    }
}
