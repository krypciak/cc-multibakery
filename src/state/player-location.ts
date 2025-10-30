import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { StateMemory } from './state-util'
import {
    getPlayerLocations,
    mergePlayerLocations,
    PlayerLocation,
    PlayerLocationRecord,
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
        get(packet, player) {
            if (packet.playerLocations || player?.dummy.data.currentMenu != sc.MENU_SUBMENU.MAP) return

            ig.playerLocationsMemory ??= {}
            const memory = StateMemory.getBy(ig.playerLocationsMemory, player)

            const locations = getPlayerLocations()
            if (player) {
                delete locations[player.tpInfo.map]
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
