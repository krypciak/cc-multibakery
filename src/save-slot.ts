export async function createSlot(name: string, originMap: string = 'rhombus-dng.entrance', marker: string = 'start') {
    if (ig.storage.slots.some(slot => slot.data.saveName == name)) return
    console.log(`slot: ${name} not found, creating a new one ${originMap}@${marker}`)
    ig.game.start()
    ig.game.transitionTimer = 0
    ig.game.teleport(originMap, new ig.TeleportPosition(marker))

    sc.menu.newSlot()
    const id = 0
    ig.storage.slots[id].data.saveName = name
    const newSlot = new ig.SaveSlot(ig.storage.slots[id].data)
    ig.storage.slots[id] = newSlot
    ig.storage._saveToStorage()

    return new Promise<void>(resolve => {
        setTimeout(() => {
            sc.model.enterReset()
            sc.model.enterRunning()
            ig.game.reset()
            sc.model.enterTitle()
            resolve()
        }, 3e3)
    })
}
