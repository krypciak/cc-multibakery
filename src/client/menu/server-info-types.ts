import type { NetTransportClientSettings } from '../../net/net-transport'
import { isModCompatibilityList, type ModCompatibilityList } from '../../server/mod-compatibility-list-types'
import type { PhysicsServerConnectionSettings } from '../../server/physics/physics-server-types'
import {
    isRemoteServerConnectionSettings,
    type RemoteServerConnectionSettings,
} from '../../server/remote/remote-server-types'

interface ServerDetailsBase {
    title: string
    description: string

    forceJsonCommunication?: boolean /* do not use binary encoding for packets */
}
function isServerDetailsBase(data: unknown): data is ServerDetailsBase {
    if (!data || typeof data !== 'object') return false
    if (!('title' in data) || typeof data.title !== 'string') return false
    if (!('description' in data) || typeof data.description !== 'string') return false
    return true
}

export interface ServerDetailsRemote extends ServerDetailsBase {
    hasIcon?: boolean
    gameTps: number
    forceConsistentTickTimes?: boolean
    modCompatibility: ModCompatibilityList
    mapSwitchDelay?: number

    transport: NetTransportClientSettings
}
export function isServerDetailsRemote(data: unknown): data is ServerDetailsRemote {
    if (!isServerDetailsBase(data)) return false
    if (!('gameTps' in data) || typeof data.gameTps !== 'number') return false
    if (!('modCompatibility' in data) || !isModCompatibilityList(data.modCompatibility)) return false
    return true
}

export interface NetServerInfoRemote {
    connection: RemoteServerConnectionSettings
    details?: ServerDetailsRemote
}
export function isNetServerInfoRemote(data: unknown): data is NetServerInfoRemote {
    if (!data || typeof data !== 'object') return false
    if (!('connection' in data) || !isRemoteServerConnectionSettings(data.connection)) return false
    if ('details' in data) {
        if (!isServerDetailsRemote(data.details)) return false
    }
    return true
}

export interface ServerDetailsPhysics extends ServerDetailsBase {
    iconPath?: string
}

export interface NetServerInfoPhysics {
    connection: PhysicsServerConnectionSettings
    details: ServerDetailsPhysics
    discovery?: boolean
}
