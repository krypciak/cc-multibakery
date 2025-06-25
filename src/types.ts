import type {} from 'cc-determine/src/plugin'
import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/ui/pause-screen/pause-screen-api'

declare global {
    /* build constants */
    const PHYSICS: boolean
    const PHYSICSNET: boolean
    const REMOTE: boolean
    const BROWSER: boolean

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
}
