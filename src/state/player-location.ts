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
                (a, b) => a === b || (a?.z == b?.z && Vec2.equal(a!, b!)),
                (a: Nullable<PlayerLocation> | undefined) => a && Vec3.create(a)
            )
        },
        set(packet) {
            if (!packet.playerLocations) return

            mergePlayerLocations(packet.playerLocations)
        },
    })
})
