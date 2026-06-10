import type { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { Mod1 } from 'cc-instanceinator/src/types'
import ccmod from '../ccmod.json'
import { executePostload, executePoststart, executePreload, executePrestart } from './loading-stages'

import './multiplayer'
import './options'
import './misc/modify-prototypes'
import './test/test-setup-mod-side'
import './dev-start'

export default class Multibakery implements PluginClass {
    static dir: string
    static mod: Mod1
    static manifest: typeof import('../ccmod.json') = ccmod

    constructor(mod: Mod1) {
        Multibakery.dir = mod.baseDirectory
        Multibakery.mod = mod
        Multibakery.mod.isCCL3 = mod.findAllAssets ? true : false
        Multibakery.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
        if (!Multibakery.mod.isCCL3) Object.assign(mod, { id: Multibakery.mod.name })

        if (!TEST) {
            if (window.crossnode) {
                if (!CROSSNODE) throw new Error('running in crossnode but not compiled with crossnode flag!')
            } else {
                if (CROSSNODE) throw new Error('running in browser but compiled with crossnode flag!')
            }
        }
    }

    async preload() {
        await executePreload()
    }

    async postload() {
        await executePostload()
    }

    async prestart() {
        await executePrestart()
    }

    async poststart() {
        await executePoststart()
    }
}
