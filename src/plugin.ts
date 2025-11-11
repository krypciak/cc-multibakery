import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import ccmod from '../ccmod.json'
import { Mod1 } from 'cc-instanceinator/src/types'
import { executePostload, executePoststart, executePrestart } from './loading-stages'
import './multiplayer'
import './options'
import './misc/modify-prototypes'
import './tests'
import './dev-start'

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

/* TODO: npc stuff fix */
/* TODO: stats clone for new players */
