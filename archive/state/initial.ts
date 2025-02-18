import { InitialState } from '../api'
import { CCMap } from '../ccmap'
import { getFullEntityState } from './states'

export function getInitialState(map: CCMap): InitialState {
    const saveSlotData: ig.SaveSlot.Data = {} as any
    ig.storage._saveState(saveSlotData)
    /* load from player state todo */
    /* for know this */
    saveSlotData.player.currentElementMode = sc.ELEMENT.NEUTRAL
    saveSlotData.party.currentParty = []

    const saveSlot = new ig.SaveSlot(saveSlotData)

    const entityStates = getFullEntityState(map.entities)

    return {
        saveData: saveSlot.getSrc(),
        packet: {
            entityStates,
        },
    }
}
