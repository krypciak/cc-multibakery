import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/ui/pause-screen/pause-screen-api'
import 'ts-binarifier/src/type-aliases'

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

    /* personal dev utils, used for debugging stuff only */
    function findClassName(id: any): string
    function fcn(id: any): string
}
