import type {} from 'cc-determine/src/plugin'
import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/headers/nax/input-field.d.ts'
import type {} from 'nax-ccuilib/src/headers/nax/input-field-cursor.d.ts'
import type {} from 'nax-ccuilib/src/headers/nax/input-field-type.d.ts'

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

    function findClassName(id: any): string
}
