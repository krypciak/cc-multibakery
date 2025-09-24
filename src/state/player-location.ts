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
                delete locations[player.mapName]
            }
            packet.playerLocations = memory.diffRecord2Deep(
                locations,
                (a, b) => a.pos === b.pos || (a.pos?.z == b.pos?.z && Vec3.equal(a.pos!, b.pos!)),
                (a: PlayerLocation) => ({ pos: a.pos && Vec3.create(a.pos) })
            )
        },
        set(packet) {
            if (!packet.playerLocations) return

            mergePlayerLocations(packet.playerLocations)
        },
    })
})
