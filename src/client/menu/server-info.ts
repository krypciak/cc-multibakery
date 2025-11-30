import { type RemoteServerConnectionSettings } from '../../server/remote/remote-server'
import { DEFAULT_HTTP_PORT } from '../../net/web-server'
import { type PhysicsServerConnectionSettings } from '../../server/physics/physics-server'
import { Opts } from '../../options'
import { type ModCompatibilityList } from '../../server/mod-compatibility-list'

interface ServerDetailsBase {
    title: string
    description: string

    /* disables binary encoding */
    forceJsonCommunication?: boolean
}
export interface ServerDetailsRemote extends ServerDetailsBase {
    hasIcon?: boolean
    globalTps: number
    forceConsistentTickTimes?: boolean
    modCompatibility: ModCompatibilityList
    mapSwitchDelay?: number
}

export interface NetServerInfoRemote {
    connection: RemoteServerConnectionSettings
    details?: ServerDetailsRemote
}

export interface ServerDetailsPhysics extends ServerDetailsBase {
    iconPath?: string
}

export interface NetServerInfoPhysics {
    connection: PhysicsServerConnectionSettings
    details: ServerDetailsPhysics
}

export const serverListDefault: NetServerInfoRemote[] = [
    {
        connection: {
            type: 'socket',
            host: 'crosscode.krypek.cc',
            port: 443,
        },
    },
    {
        connection: {
            type: 'socket',
            host: '127.0.0.1',
            port: DEFAULT_HTTP_PORT,
        },
    },
]
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
