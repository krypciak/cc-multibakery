import 'ultimate-crosscode-typedefs'
import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/ui/pause-screen/pause-screen-api'
import type {} from 'nax-ccuilib/src/ui/quick-menu/quick-menu-extension'
import type {} from 'cc-variable-charge-time/src/plugin'
import type {} from 'cc-krypek-lib/src/plugin'
import type {} from 'cc-jetpack-widget/src/plugin'
import 'ts-binarifier/src/type-aliases'
import './net/binary/binary-types'

declare global {
    /* build constants */
    const PHYSICS: boolean
    const PHYSICSNET: boolean
    const REMOTE: boolean
    const BROWSER: boolean
    const ASSERT: boolean
    const PROFILE: boolean

    namespace NodeJS {
        interface Timeout {
            id: number
        }
    }
}
