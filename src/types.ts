import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/ui/pause-screen/pause-screen-api'
import 'ts-binarifier/src/type-aliases'
import { f32 } from 'ts-binarifier/src/type-aliases'

declare global {
    /* build constants */
    const PHYSICS: boolean
    const PHYSICSNET: boolean
    const REMOTE: boolean
    const BROWSER: boolean
    const ASSERT: boolean

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

    function findClassName(id: any): string
    function fcn(id: any): string
}

declare global {
    interface Vec2 {
        x: f32
        y: f32
    }
    interface Vec3 {
        x: f32
        y: f32
        z: f32
    }
}
