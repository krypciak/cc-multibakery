import { assert } from '../misc/assert'
import type { NetTransportServer } from './net-manager-physics'
import type { NetTransportClient } from './net-manager-remote'
import {
    SocketIoNetTransportClient,
    SocketIoNetTransportServer,
    type SocketIoNetTransportClientSettings,
    type SocketIoNetTransportServerSettings,
} from './socket-io'

export type NetTransportServerSettings = {
    type: 'socket.io'
} & SocketIoNetTransportServerSettings

export type NetTransportClientSettings = {
    type: 'socket.io'
} & SocketIoNetTransportClientSettings

export function isNetTransportSettigns(data: unknown): data is NetTransportServerSettings | NetTransportClientSettings {
    if (!data || typeof data !== 'object') return false
    if (!('type' in data) || typeof data.type !== 'string') return false
    return true
}

export interface NetTransportListenerFunctions {
    onReceive(data: Uint8Array): void
    onBytesSent(bytes: bigint): void
    onBytesReceived(bytes: bigint): void
}
export interface NetTransport {
    send(data: unknown): void
    close(): void
    isConnected(): boolean
    getInfo(): string
}

export const defaultNetTransport: NetTransportType = 'socket.io'

const netTransportMap = {
    'socket.io': { client: SocketIoNetTransportClient, server: SocketIoNetTransportServer },
} as const

export type NetTransportType = keyof typeof netTransportMap

function get(type: NetTransportType) {
    const obj = netTransportMap[type]
    assert(obj, `unknown net transport: ${type}`)
    return obj
}
export function createNetTransportClient(settings: NetTransportClientSettings): NetTransportClient {
    return new (get(settings.type).client)(settings as any)
}
export function createNetTransportServer(settings: NetTransportServerSettings): NetTransportServer {
    return new (get(settings.type).server)(settings as any)
}

export function convertNetTransportServerSettingsToClientSettings(
    settings: NetTransportServerSettings
): NetTransportClientSettings {
    return settings
}
