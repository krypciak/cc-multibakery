import { ToClientUpdatePacket } from './api'
import { getDiffEntityState } from './state/states'

export class UpdatePacketGather {
    static state: Record<string, ToClientUpdatePacket> = {}
    private ignoreVars = new Set<string>(['mouse.active', 'gamepad.active'])

    constructor() {
        /* in prestart */
        const self = this
        ig.Vars.inject({
            set(path, value) {
                if (!path || self.ignoreVars.has(path)) return this.parent(path, value)
                if (ig.vars.get(path) !== value) {
                    const packet = (UpdatePacketGather.state[ig.game.mapName] ??= {})
                    packet.vars ??= []
                    packet.vars.push({ path, value })
                }

                this.parent(path, value)
            },
        })
    }

    private entityStateUpdates() {
        for (const map of ig.multiplayer.server.getActiveMaps()) {
            const entry = (UpdatePacketGather.state[map.mapName] ??= {})
            entry.entityStates = getDiffEntityState(map.entities)
        }
    }

    pop(): Record<string, ToClientUpdatePacket> {
        this.entityStateUpdates()
        const state = UpdatePacketGather.state
        UpdatePacketGather.state = {}
        return state
    }
}
