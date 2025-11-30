import { prestart } from '../loading-stages'
import { addStateHandler, type StateKey } from './states'
import { StateMemory } from './state-util'
import {
    getPlayerLocations,
    mergePlayerLocations,
    type PlayerLocation,
    type PlayerLocationRecord,
} from '../map-gui/player-locations'

declare global {
    interface StateUpdatePacket {
        playerLocations?: PlayerLocationRecord
    }
    namespace ig {
        var playerLocationsMemory: StateMemory.MapHolder<StateKey> | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (packet.playerLocations || client?.dummy.data.currentMenu != sc.MENU_SUBMENU.MAP) return

            ig.playerLocationsMemory ??= {}
            const memory = StateMemory.getBy(ig.playerLocationsMemory, client)

            const locations = getPlayerLocations()
            if (client) {
                delete locations[client.tpInfo.map]
            }
            packet.playerLocations = memory.diffRecord2Deep(
                locations,
                (a, b) => a?.pos?.x == b?.pos?.x && a?.pos?.y == b?.pos?.y,
                (a: PlayerLocation) => ({ pos: a.pos && Vec2.create(a.pos) })
            )
        },
        set(packet) {
            if (!packet.playerLocations) return

            mergePlayerLocations(packet.playerLocations)
        },
    })
})
