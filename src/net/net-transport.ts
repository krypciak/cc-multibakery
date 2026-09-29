import { assert } from '../misc/assert'
import type { NetTransportServer } from './net-manager-physics'
import type { NetTransportClient } from './net-manager-remote'
import {
    WsNetTransportClient,
    WsNetTransportServer,
    type WsNetTransportClientSettings,
    type WsNetTransportServerSettings,
} from './websocket'

export type NetTransportServerSettings = {
    type: 'websocket'
} & WsNetTransportServerSettings

export type NetTransportClientSettings = {
    type: 'websocket'
} & WsNetTransportClientSettings

export interface NetTransportListenerFunctions {
    onReceive(data: Uint8Array<ArrayBuffer>): void
    onBytesSent(bytes: number): void
    onBytesReceived(bytes: number): void
    onClose(reason: string): void
}
export interface NetTransport {
    send(data: Uint8Array<ArrayBuffer>): void
    close(): void
    isConnected(): boolean
    getStatusInfo(): string
    getConnectionInfo(): string
}

const netTransportMap = {
    websocket: { client: WsNetTransportClient, server: WsNetTransportServer },
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
