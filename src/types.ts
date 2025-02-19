import type {} from 'cc-determine/src/plugin'
import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import { Multiplayer } from './multiplayer'

declare global {
    namespace NodeJS {
        interface Timeout {
            id: number
        }
        interface Global {
            multi: Multiplayer
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

    var multi: Multiplayer
}
