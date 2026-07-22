import type { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { Mod1 } from 'cc-instanceinator/src/types'
import { executePostload, executePoststart, executePreload, executePrestart } from './loading-stages'
import { setModMetadata } from './mod-metadata'

import './multiplayer'
import './options'
import './misc/modify-prototypes'
import './test/test-utils'
import './dev-start'

export default class Multibakery implements PluginClass {
    constructor(mod: Mod1) {
        setModMetadata(mod)

        if (!TEST) {
            if (window.crossnode) {
                if (!CROSSNODE) console.warn('running in crossnode but not compiled with crossnode flag!')
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
