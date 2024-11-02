import { Mod, PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'

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

    async prestart() {}

    async poststart() {}
}
