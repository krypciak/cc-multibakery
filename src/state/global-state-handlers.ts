import type { NetConnection } from '../net/net-connection'

declare global {
    interface GlobalStateUpdatePacket {}
}

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
import { actionSettingsGlobalStateHandler } from './entity/action-serializer'
import { playerTeleportGlobalStateHandler } from './player-teleport'

const globalStateHandlers: GlobalStateHandler[] = [
    playerTeleportGlobalStateHandler,
    varsGlobalStateHandler,
    areasGlobalStateHandler,
    playerInfoGlobalStateHandler,
    partyGlobalStateHandler,
    actionSettingsGlobalStateHandler,
]

export function getGlobalStateUpdatePacket(
    dest: GlobalStateUpdatePacket = {},
    conn: GlobalStateKey,
    cache?: GlobalStateUpdatePacket
) {
    for (const { get } of globalStateHandlers) get(dest, conn, cache)

    return dest
}

export function applyGlobalStateUpdatePacket(packet: GlobalStateUpdatePacket) {
    ig.shared.settingState = true

    for (const { set } of globalStateHandlers) set(packet)

    ig.shared.settingState = false
}

export function clearCollectedGlobalState() {
    for (const { clear } of globalStateHandlers) clear?.()
}
