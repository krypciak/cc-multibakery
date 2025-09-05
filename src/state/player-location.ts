import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { StateMemory } from './state-util'
import { getPlayerLocations, mergePlayerLocations, PlayerLocationRecord } from '../map-gui/player-locations'

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

            packet.playerLocations = getPlayerLocations()
            // (a, b) => a === b || (a?.mapName == b?.mapName && Vec3.equal(a!.pos, b!.pos))
        },
        set(packet) {
            if (!packet.playerLocations) return

            mergePlayerLocations(packet.playerLocations)
        },
    })
})
