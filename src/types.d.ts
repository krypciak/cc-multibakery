import { Mod } from 'ultimate-crosscode-typedefs/modloader/mod'
import { Multiplayer } from './multiplayer'

export type Mod1 = Mod & {
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

declare global {
    namespace NodeJS {
        interface Timeout {
            id: number
        }
    }

    namespace ig {
        namespace SaveSlot {
            interface Data {
                saveName?: string /* from Named-Saves */
            }
        }

        interface System {
            frame: number
        }
    }

    var server: Multiplayer
}
