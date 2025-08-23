import { prestart } from '../plugin'
import { addStateHandler, StateKey } from './states'
import { cleanRecord, StateMemory } from './state-util'
import { PvpTeam } from '../pvp/pvp'
import { assert } from '../misc/assert'

export interface PvpTeamSerialized {
    name: string
    party: sc.COMBATANT_PARTY
    players: string[]
}

interface PvpObj {
    on?: boolean
    winPoints?: number
    teams?: PvpTeamSerialized[]
    round?: number
    state?: number
    points?: PartialRecord<sc.COMBATANT_PARTY, number>
}

declare global {
    interface StateUpdatePacket {
        pvp?: PvpObj
    }
    namespace ig {
        var pvpStatePlayerMemory: StateMemory.MapHolder<StateKey> | undefined
    }
}

function serializeTeam(team: PvpTeam): PvpTeamSerialized {
    return {
        ...team,
        players: team.players.map(player => player.netid),
    }
}

function deserializeTeam(team: PvpTeamSerialized): PvpTeam {
    return {
        ...team,
        players: team.players.map(netid => {
            const player = ig.game.entitiesByNetid[netid]
            assert(player)
            assert(player instanceof dummy.DummyPlayer)
            return player
        }),
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            if (packet.pvp) return

            ig.pvpStatePlayerMemory ??= {}
            const memory = StateMemory.getBy(ig.pvpStatePlayerMemory, player)

            const serializedTeams = sc.pvp.teams?.map(serializeTeam)

            packet.pvp = cleanRecord({
                on: memory.diff(sc.pvp.multiplayerPvp),
                teams:
                    sc.pvp.teams &&
                    (sc.pvp.teams.length > 0 ? true : undefined) &&
                    memory.diffArray(
                        serializedTeams,
                        (a, b) => a.name == b.name && a.party == b.party && a.players.length == b.players.length
                    ),
                winPoints: memory.diff(sc.pvp.winPoints),
                state: memory.diff(sc.pvp.state),
                points: memory.diffRecord(sc.pvp.points),
                round: memory.diff(sc.pvp.round),
            })
        },
        set(packet) {
            if (!packet.pvp) return

            if (packet.pvp.winPoints !== undefined) {
                sc.pvp.winPoints = packet.pvp.winPoints
            }

            if (packet.pvp.teams) {
                sc.pvp.teams = packet.pvp.teams.map(deserializeTeam)
            }

            if (packet.pvp.on !== undefined) {
                if (packet.pvp.on) {
                    assert(!sc.pvp.multiplayerPvp)
                    sc.pvp.startMultiplayerPvp(sc.pvp.winPoints)
                } else {
                    if (sc.pvp.multiplayerPvp) sc.pvp.stop()
                }
            }

            if (packet.pvp.state !== undefined) {
                const state = packet.pvp.state
                sc.pvp.state = state

                if (sc.pvp.hpBars) sc.pvp.rearrangeHpBars()
                if (state == 2) {
                    sc.pvp.finalizeRoundStart()
                } else if (state == 3) {
                    sc.pvp.showKOGuis()
                }
            }

            if (packet.pvp.round !== undefined && sc.pvp.state != 0) {
                sc.pvp.round = packet.pvp.round - 1
                sc.pvp.startNextRound()
            }

            if (packet.pvp.points) {
                StateMemory.applyChangeRecord(sc.pvp.points, packet.pvp.points)
            }
        },
    })
})
