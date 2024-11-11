import { Mod, PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { CrossnodeTest } from 'crossnode/crossnode.d.ts'

export type Mod1 = Writable<Mod> & {
    isCCModPacked: boolean
    findAllAssets?(): void /* only there for ccl2, used to set isCCL3 */
} & (
        | {
              isCCL3: true
              id: string
              findAllAssets(): void
          }
        | {
              isCCL3: false
              name: string
              filemanager: {
                  findFiles(dir: string, exts: string[]): Promise<string[]>
              }
              getAsset(path: string): string
              runtimeAssets: Record<string, string>
          }
    )

export default class Test implements PluginClass {
    static mod: Mod1

    constructor(mod: Mod1) {
        // Test.dir = mod.baseDirectory
        Test.mod = mod
        Test.mod.isCCL3 = mod.findAllAssets ? true : false
        Test.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    async prestart() {
        if (window.crossnode) {
            let i = 0
            function genTest(): CrossnodeTest {
                let finishFunc: any
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
                                    return `{ x: ${v.x}, y: ${v.y}, z: ${v.z} }`
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

    async poststart() {}
}
