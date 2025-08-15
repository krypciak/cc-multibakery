import { ServerPlayer } from '../server/server-player'

declare global {
    interface StateUpdatePacket {}
}

export type StateKey = ServerPlayer

import './entity'
import './vars'

declare global {
    namespace ig {
        var settingState: boolean | undefined
        var settingStateImmediately: boolean | undefined
        var lastStatePacket: StateUpdatePacket | undefined
    }
}

export function getStateUpdatePacket(player?: StateKey) {
    const packet: StateUpdatePacket = {}

    for (const { get } of handlers) get(packet, player)

    return packet
}

type Handler = {
    get: (packet: StateUpdatePacket, player?: StateKey) => void
    set: (packet: StateUpdatePacket) => void
}
const handlers: Handler[] = []
export function addStateHandler(handler: Handler) {
    handlers.push(handler)
}

export function applyStateUpdatePacket(packet: StateUpdatePacket, tick: number, immediately: boolean) {
    ig.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick
    ig.settingStateImmediately = immediately

    for (const { set } of handlers) set(packet)

    ig.system.tick = backup
    ig.settingState = false
    ig.settingStateImmediately = false
    ig.lastStatePacket = packet
}
