import { ToClientUpdatePacket } from './api'

export class UpdatePacketGather {
    private state: Record<string, ToClientUpdatePacket> = {}
    private ignoreVars = new Set<string>(['mouse.active', 'gamepad.active'])

    constructor() {
        /* in prestart */
        const self = this
        ig.Vars.inject({
            set(path, value) {
                if (!path || self.ignoreVars.has(path)) return this.parent(path, value)
                if (ig.vars.get(path) !== value) {
                    const packet = (self.state[ig.game.mapName] ??= {})
                    packet.vars ??= []
                    packet.vars.push({ path, value })
                }

                this.parent(path, value)
            },
        })
    }

    pop(): Record<string, ToClientUpdatePacket> {
        const state = this.state
        this.state = {}
        return state
    }
}
