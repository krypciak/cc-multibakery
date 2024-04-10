import { ToClientUpdatePacket } from './api'

export class UpdatePacketGather {
    private state: Record<string, ToClientUpdatePacket> = {}
    private statePlayer: Record<string, ToClientUpdatePacket> = {}
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

    private clientStateCorrection() {
        const s = ig.multiplayer.server?.s?.clientStateCorrection
        if (!s) return

        for (const mapName in ig.multiplayer.server.maps) {
            const map = ig.multiplayer.server.maps[mapName]
            for (const player of map.players) {
                if (s.posTickInterval && ig.system.frame % s.posTickInterval == 0 && !player.isTeleporting) {
                    const state = (this.statePlayer[player.name] ??= {})
                    state.pos = Vec3.create(player.dummy.coll.pos)
                }
            }
        }
    }

    pop(): { state: Record<string, ToClientUpdatePacket>; statePlayer: Record<string, ToClientUpdatePacket> } {
        if (!ig.multiplayer.server.s.rollback) {
            this.clientStateCorrection()
        }
        const state = this.state
        const statePlayer = this.statePlayer
        this.state = {}
        this.statePlayer = {}
        return { state, statePlayer }
    }
}
