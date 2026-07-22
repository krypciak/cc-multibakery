import { assert } from '../../misc/assert'
import type { NetServerInfoRemote } from '../../client/menu/server-info-types'
import type { StrictNonNullable } from '../../types'
import type { ModCompatibilityList } from '../mod-compatibility-list-types'
import type { ServerSettings } from '../server-types'
import type { RemoteServer } from './remote-server'

export function isRemote(server: typeof multi.server): server is RemoteServer {
    return server && !server.physics
}
export function assertRemote(server: typeof multi.server): asserts server is RemoteServer {
    assert(!server?.physics)
}

export interface RemoteServerConnectionSettings {
    host: string
    port: number
}
export function isRemoteServerConnectionSettings(data: unknown): data is RemoteServerConnectionSettings {
    if (!data || typeof data !== 'object') return false
    if (!('host' in data) || typeof data.host !== 'string') return false
    if (!('port' in data) || typeof data.port !== 'number') return false

    return true
}

export interface RemoteServerSettings extends ServerSettings {
    netInfo: StrictNonNullable<NetServerInfoRemote>
    modCompatibility?: ModCompatibilityList
}

export interface ClientLeaveData {
    username: string
}
export function isClientLeaveData(data: unknown): data is ClientLeaveData {
    return !!data && typeof data == 'object' && 'username' in data && typeof data.username == 'string'
}
