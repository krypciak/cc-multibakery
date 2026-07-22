import { assert } from '../misc/assert'
import type { InstanceinatorCopyInstanceConfig } from 'cc-instanceinator/src/instance-copy'
import type { ClientSettings } from '../client/client-types'
import type { EntityNetid } from '../misc/entity-netid'
import type { MapName, Username } from '../net/binary/binary-types'
import type { NetConnection } from '../net/net-connection'

export interface MapTpInfo {
    map: MapName
    marker?: Nullable<string>
}

export interface ServerSettings {
    gameTps: number
    forceConsistentTickTimes?: boolean
    gameLoopIntervalTps?: number
    useAnimationFrameAsFpsLimiter?: boolean

    displayServerInstance?: boolean
    displayMaps?: boolean
    forceMapsActive?: boolean
    displayInactiveMaps?: boolean
    disableMapDisplayCameraMovement?: boolean
    displayClientInstances?: boolean
    displayRemoteClientInstances?: boolean
    defaultMap?: MapTpInfo
    attemptCrashRecovery?: boolean
    mapSwitchDelay?: number
}

export interface ClientJoinData {
    username: Username
    initialInputType?: ig.INPUT_DEVICES
    preferredTpInfo?: MapTpInfo
}
export function isClientJoinData(_data: unknown): _data is ClientJoinData {
    const data = _data as ClientJoinData
    if (!data || typeof data !== 'object') return false
    if (!data.username || typeof data.username !== 'string') return false
    if (data.initialInputType !== undefined) {
        if (typeof data.initialInputType !== 'number') return false
        if (!Object.values(ig.INPUT_DEVICES).includes(data.initialInputType)) return false
    }
    return true
}
export type ClientJoinAckData =
    | {
          status: 'username_taken' | 'invalid_join_data' | 'invalid_username'
      }
    | {
          status: 'ok'
          tpInfo?: MapTpInfo
          reservedNetid?: EntityNetid
      }

export interface ClientCreateAndJoinSettings {
    connection?: NetConnection
    awaitClientJoin?: boolean
    clientSettingsOverride?: Partial<ClientSettings>
    ackDataOverride?: ClientJoinAckData
}

export function instanceinatorCopyInstanceConfig(): InstanceinatorCopyInstanceConfig {
    return { cacheKey: 'multibakery', hideTitleScreen: true }
}

export function showTryNetJoinResponseDialog(joinData: ClientJoinData, resp: ClientJoinAckData) {
    if (resp.status == 'ok') return
    let msg!: string
    assert(resp.status != 'invalid_join_data', 'invalid_join_data??')
    if (resp.status == 'username_taken') msg = `Error: username "${joinData.username}" is taken.`
    else if (resp.status == 'invalid_username') msg = `Error: username "${joinData.username} is invalid.`
    assert(msg)
    sc.Dialogs.showErrorDialog(msg)
}
