import { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { CrossnodeTest } from 'crossnode/crossnode.d.ts'
import { Mod1 } from './types'
import { DEFAULT_PORT, Multiplayer } from './multiplayer'

import 'setimmediate'
import { LocalServer } from './local-server'

import './misc/modify-prototypes'
import './misc/entity-uuid'
import './misc/skip-title-screen'
import './misc/godmode'
import './misc/gamepad-focus-fix'
import './local-client'

let prestartFunctions: (() => void | Promise<void>)[]
export function prestart(func: () => void | Promise<void>) {
    prestartFunctions ??= []
    prestartFunctions.push(func)
}

export default class Multibakery implements PluginClass {
    static dir: string
    static mod: Mod1

    constructor(mod: Mod1) {
        Multibakery.dir = mod.baseDirectory
        Multibakery.mod = mod
        Multibakery.mod.isCCL3 = mod.findAllAssets ? true : false
        Multibakery.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    async prestart() {
        await Promise.all(prestartFunctions.map(f => f()))

        window.multi = new Multiplayer()
        if (window.crossnode) global.multi = window.multi

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

        if (window.crossnode && window.crossnode.options.test) {
            let i = 0
            function genTest(): CrossnodeTest {
                let finishFunc: (success: boolean, msg?: string | undefined) => void
                let myI = i
                i++
                return {
                    fps: 60,
                    skipFrameWait: true,
                    timeoutSeconds: 1000e3,

                    seed: 'welcome to hell',
                    modId: 'cc-multibakery',
                    name: `example test ${myI}`,
                    async setup(finish) {
                        ig.interact.entries.forEach(e => ig.interact.removeEntry(e))

                        sc.model.enterNewGame()
                        sc.model.enterGame()
                        ig.game.reset()
                        ig.game.setPaused(false)

                        await window.crossnode.testUtil.loadLevel('crossnode/bots28')

                        finishFunc = finish
                    },
                    update(frame) {
                        if (frame >= 3 * 60) {
                            const expected = { x: 262.87, y: 268.09, z: 0 }
                            const ppos = ig.game.playerEntity.coll.pos
                            if (Vec3.equal(ppos, expected)) {
                                finishFunc(true)
                            } else {
                                function pv(v: Vec3) {
                                    return `{ x: ${v.x}, y: ${v.y.toString()}, z: ${v.z.toString()} }}`
                                }
                                finishFunc(
                                    false,
                                    `ig.game.playerEntity.coll.pos is equal ${pv(ppos)}, expected ${pv(expected)}`
                                )
                            }
                            return
                        }
                    },
                }
            }
            for (let i = 0; i < 3; i++) {
                window.crossnode.registerTest(genTest())
            }
        }
    }

    async poststart() {
        // multi.nowServer = true
        // VarBackup.backup()
        //
        // await multi.setClient(
        //     new LocalClient({
        //         username: 'local',
        //         globalTps: 60,
        //     })
        // )
        // multi.nowServer = false
        //
        // multi.nowClient = true
        // VarBackup.restore()
        // multi.nowClient = false
    }
}
