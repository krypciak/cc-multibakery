import type { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { Mod1 } from 'cc-instanceinator/src/types'
import ccmod from '../ccmod.json'
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

/* TODO: release instanceinator */
/* TODO: check if remote items work correctly */
/* TODO: socket.ts assert holding the entire project */
/* TODO: improve performance of hidden instances */

/* todo maybe sometime */
/* TODO: npc stuff fix */
/* TODO: npc still sometimes crashes on cutscene skip spam */
/* TODO: ascended equipment rework */
/* TODO: cond entities breaking netid? */
