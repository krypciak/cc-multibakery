import { Opts } from '../../options'
import type { NetServerInfoRemote } from './server-info-types'

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
