import { InitialState } from './api'

export function getInitialState(): InitialState {
    const saveSlotData: ig.SaveSlot.Data = {} as any
    ig.storage._saveState(saveSlotData)
    /* load from player state todo */
    /* for know this */
    saveSlotData.player.currentElementMode = sc.ELEMENT.NEUTRAL
    saveSlotData.party.currentParty = []

    const saveSlot = new ig.SaveSlot(saveSlotData)

    return {
        saveData: saveSlot.getSrc(),
    }
}
