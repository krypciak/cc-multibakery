import { areasGlobalStateHandler } from './areas'
import { partyGlobalStateHandler } from './party'
import { playerInfoGlobalStateHandler } from './player-info'
import type { GlobalStateKey } from './states'
import { varsGlobalStateHandler } from './vars'

export interface GlobalStateHandler {
    get: (packet: GlobalStateUpdatePacket, conn: GlobalStateKey, cache?: GlobalStateUpdatePacket) => void
    clear?: () => void
    set: (packet: GlobalStateUpdatePacket) => void
}
export const globalStateHandlers: GlobalStateHandler[] = [
    varsGlobalStateHandler,
    areasGlobalStateHandler,
    playerInfoGlobalStateHandler,
    partyGlobalStateHandler,
]
