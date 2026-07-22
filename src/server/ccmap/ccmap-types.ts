import type { Client } from '../../client/client'
import type { CCMap } from './ccmap'

declare global {
    namespace ig {
        var ccmap: CCMap | undefined

        interface MapSharedVars {
            ccmap: CCMap
        }
        var mapShared: MapSharedVars
    }
}

export interface OnLinkChange {
    onClientLink?(this: this, client: Client): void
    onClientUnlink?(this: this, client: Client): void
}
