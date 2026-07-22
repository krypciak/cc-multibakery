import './net/binary/binary-types'
import 'ultimate-crosscode-typedefs'
import type {} from 'cc-instanceinator/src/plugin'
import type {} from 'crossnode/crossnode'
import type {} from 'ccmodmanager/types/plugin'
import type {} from 'ccmodmanager/types/gui/menu'
import type {} from 'nax-ccuilib/src/ui/pause-screen/pause-screen-api'
import type {} from 'nax-ccuilib/src/ui/quick-menu/quick-menu-extension'
import type {} from 'cc-variable-charge-time/src/plugin'
import type {} from 'cc-krypek-lib/src/plugin'
import 'ts-binarifier/src/type-aliases'

declare global {
    /* build constants */
    const PHYSICS: boolean
    const PHYSICSNET: boolean
    const REMOTE: boolean
    const BROWSER: boolean
    const ASSERT: boolean
    const DEV: boolean
    const PROFILE: boolean
    const CROSSNODE: boolean
    const TEST: boolean

    namespace NodeJS {
        interface Timeout {
            id: number
        }
    }
}

export type StrictNonNullable<T> = {
    [K in keyof T]-?: NonNullable<T[K]>
}
