import {
    isRemoteServerConnectionSettings,
    type RemoteServerConnectionSettings,
} from '../../server/remote/remote-server'
import type { NetTransportClientSettings } from '../../net/net-transport'
import type { PhysicsServerConnectionSettings } from '../../server/physics/physics-server'
import { Opts } from '../../options'
import { isModCompatibilityList, type ModCompatibilityList } from '../../server/mod-compatibility-list'

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

export function getServerListInfo(): NetServerInfoRemote[] {
    return [...Opts.serverList]
}

export function addServerListEntry(entry: NetServerInfoRemote) {
    const servers = getServerListInfo()
    servers.push(entry)
    Opts.serverList = servers
}
export function removeServerListEntry(index: number) {
    const servers = getServerListInfo()
    servers.splice(index, 1)
    Opts.serverList = servers
}

export function moveServerEntry(index: number, dir: -1 | 1): boolean {
    const servers = getServerListInfo()
    const newIndex = Math.min(servers.length - 1, Math.max(0, index + dir))
    if (index == newIndex) return false
    ;[servers[index], servers[newIndex]] = [servers[newIndex], servers[index]]
    Opts.serverList = servers

    return true
}

export function replaceServerEntry(index: number, entry: NetServerInfoRemote) {
    const servers = getServerListInfo()
    servers[index] = entry
    Opts.serverList = servers
}
