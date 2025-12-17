import { prestart } from '../loading-stages'
import { addStateHandler, type StateKey } from './states'
import { cleanRecord, StateMemory } from './state-util'
import type { u3, u6, u8 } from 'ts-binarifier/src/type-aliases'
import type { COMBATANT_PARTY } from '../net/binary/binary-types'
import type { MultiPartyId } from '../party/party'
import { assert } from '../misc/assert'

interface PvpObj {
    on?: boolean
    winPoints?: u6
    parties?: MultiPartyId[]
    round?: u8
    state?: u3
    points?: PartialRecord<COMBATANT_PARTY, u6>
}

declare global {
    interface StateUpdatePacket {
        pvp?: PvpObj
    }
    namespace ig {
        var pvpStatePlayerMemory: StateMemory.MapHolder<StateKey> | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (packet.pvp) return

            ig.pvpStatePlayerMemory ??= {}
            const memory = StateMemory.getBy(ig.pvpStatePlayerMemory, client)

            const parties = sc.pvp.parties?.map(p => p.id)

            packet.pvp = cleanRecord({
                on: memory.diff(sc.pvp.multiplayerPvp && sc.pvp.state !== 0),
                parties: parties && memory.diffArray(parties),
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

            if (packet.pvp.parties) {
                sc.pvp.parties = packet.pvp.parties.map(id => {
                    const party = multi.server.party.parties[id]
                    assert(party)
                    return party
                })
            }

            if (packet.pvp.on !== undefined) {
                if (packet.pvp.on) {
                    if (!sc.pvp.multiplayerPvp) sc.pvp.startMultiplayerPvp(sc.pvp.winPoints)
                } else {
                    if (sc.pvp.multiplayerPvp) sc.pvp.stop()
                }
            }

            if (packet.pvp.state !== undefined) {
                const state = packet.pvp.state
                sc.pvp.state = state

                if (sc.pvp.hpBars) sc.pvp.rearrangeHpBars()
                if (state == 2) {
                    if (sc.pvp.state != 2) sc.pvp.finalizeRoundStart()
                } else if (state == 3) {
                    sc.pvp.showKOGuis()
                }
            }

            if (packet.pvp.round !== undefined && sc.pvp.round != packet.pvp.round && sc.pvp.state != 0) {
                sc.pvp.round = packet.pvp.round - 1
                sc.pvp.startNextRound(true)
            }

            if (packet.pvp.points) {
                StateMemory.applyChangeRecord(sc.pvp.points, packet.pvp.points)
            }
        },
    })
})
