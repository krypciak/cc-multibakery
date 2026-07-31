import type { NetConnection } from '../net/net-connection'
export type GlobalStateKey = NetConnection

export interface GlobalStateHandler {
    get: (packet: GlobalStateUpdatePacket, conn: GlobalStateKey, cache?: GlobalStateUpdatePacket) => void
    clear?: () => void
    set: (packet: GlobalStateUpdatePacket) => void
}

import { varsGlobalStateHandler } from './vars'
import { areasGlobalStateHandler } from './areas'
import { playerInfoGlobalStateHandler } from './player-info'
import { partyGlobalStateHandler } from './party'

export const globalStateHandlers: GlobalStateHandler[] = [
    varsGlobalStateHandler,
    areasGlobalStateHandler,
    playerInfoGlobalStateHandler,
    partyGlobalStateHandler,
]
