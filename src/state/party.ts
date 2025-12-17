import { prestart } from '../loading-stages'
import { addGlobalStateHandler, type GlobalStateKey } from './states'
import { StateMemory } from './state-util'
import { type MultiParty, type MultiPartyId, type PartialMultiParty } from '../party/party'

declare global {
    interface GlobalStateUpdatePacket {
        parties?: Record<MultiPartyId, PartialMultiParty>
    }
}

prestart(() => {
    const partiesStateMemory: StateMemory.MapHolder<GlobalStateKey> = {}
    addGlobalStateHandler({
        get(packet, conn) {
            const memory = StateMemory.getBy(partiesStateMemory, conn)

            packet.parties = memory.diffRecord2Deep<keyof MultiParty, MultiParty>(
                multi.server.party.parties,
                {
                    players: (a, b) => a.length != b.length || a.some((v, i) => v != b[i]),
                    vanillaMembers: (a, b) => a.length != b.length || a.some((v, i) => v != b[i]),
                },
                {
                    players: arr => [...arr],
                    vanillaMembers: arr => [...arr],
                }
            )
        },
        set(packet) {
            if (!packet.parties) return

            for (const partyName in packet.parties) {
                const partyData = packet.parties[partyName]
                const party = multi.server.party.parties[partyName]
                if (!party) {
                    multi.server.party.addParty(partyData as MultiParty)
                } else {
                    if (partyData.owner !== undefined) party.owner = partyData.owner
                    if (partyData.title !== undefined) multi.server.party.changePartyTitle(party, partyData.title)
                    if (partyData.players !== undefined) {
                        for (const username of partyData.players) {
                            if (party.players.includes(username)) continue
                            if (multi.server.party.getPartyOfUsername(username, true) !== undefined) {
                                multi.server.party.switchParty(username, party)
                            } else {
                                multi.server.party.joinParty(username, party)
                            }
                        }
                    }
                    if (partyData.vanillaMembers !== undefined) {
                        for (const modelName of party.vanillaMembers) {
                            if (partyData.vanillaMembers.includes(modelName)) continue
                            multi.server.party.leavePartyVanillaMember(modelName, party)
                        }
                        for (const modelName of partyData.vanillaMembers) {
                            if (party.vanillaMembers.includes(modelName)) continue
                            multi.server.party.joinPartyVanillaMember(modelName, party)
                        }
                    }
                }
            }
        },
    })
})
