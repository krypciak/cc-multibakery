import { runTask } from 'cc-instanceinator/src/inst-util'
import { poststart, prestart } from '../../../loading-stages'
import type { getState } from '../../../state/entity/ig_ENTITY_Player-base'
import { PhysicsServer } from '../physics-server'
import { assert } from '../../../misc/assert'

import './save-slot-button'
import './pause-screen-save-button'
import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

type PlayerGetStateReturn = ReturnType<typeof getState>
type PlayerState = PlayerGetStateReturn & {
    mapName: string
    marker?: Nullable<string>
}

export interface MultibakerySaveData {
    players?: Record<string, PlayerState>
}

declare global {
    namespace ig.SaveSlot {
        interface Data {
            multibakery?: MultibakerySaveData
        }
    }
}

class MultiStorage implements ig.Storage.ListenerSave, ig.Storage.ListenerPostLoad {
    currentData?: MultibakerySaveData
    saving: boolean = false

    onStorageSave(this: this, savefile: ig.SaveSlot.Data): void {
        savefile.multibakery = this.currentData

        if (!(multi.server instanceof PhysicsServer)) return

        this.currentData = savefile.multibakery ??= {}
        this.saveData()
    }

    onStoragePostLoad(this: this, savefile: ig.SaveSlot.Data): void {
        this.currentData = savefile.multibakery
    }

    private addPrettyTextToSave(save: ig.SaveSlot.Data) {
        const masterClient = multi.server.getMasterClient()
        if (!masterClient) {
            save.area = { en_US: 'Multibakery server', langUid: 1 }
            save.specialMap = { en_US: 'None', langUid: 1 }
        }
    }

    wrapFilterListeners(func: () => void) {
        const listenersBackup = ig.storage.listeners
        const relevantListeners = ig.storage.listeners.filter(
            listener => !('_instanceId' in listener) || listener._instanceId == instanceinator.id
        )
        ig.storage.listeners = relevantListeners

        func()

        ig.storage.listeners = listenersBackup
    }

    private getSaveData() {
        const masterInstance = multi.server.getMasterClient()?.inst ?? multi.server.inst
        assert(masterInstance)

        const partialSave: Partial<ig.SaveSlot.Data> = {}
        runTask(masterInstance, () => {
            this.saving = true
            this.wrapFilterListeners(() => {
                ig.storage._saveState(partialSave, ig.game.mapName ?? 'multibakery/dev')
            })
            this.saving = false
        })
        return partialSave as ig.SaveSlot.Data
    }

    private commitSave(save: ig.SaveSlot.Data, slotId?: number) {
        const saveSlot = new ig.SaveSlot(save)

        ig.storage.autoSlot = saveSlot
        ig.storage.checkPointSave = save

        let saved = false

        if (multi.server instanceof PhysicsServer) {
            const { manualSaving, automaticlySave } = multi.server.settings.save ?? {}

            if (slotId === undefined) {
                if (automaticlySave) {
                    slotId = ig.storage.lastUsedSlot
                }
            } else if (!manualSaving) {
                slotId = undefined
            }

            if (slotId !== undefined && slotId != -1) {
                if (ig.storage.slots[slotId]) ig.storage.slots.splice(slotId, 1)
                ig.storage.slots.unshift(saveSlot)
                ig.storage.lastUsedSlot = 0
                ig.storage._saveToStorage()
                saved = true
            }
        }

        if (!saved) {
            ig.storage.lastUsedSlot = -1
        }
    }

    save(slotId?: number) {
        const save = this.getSaveData()
        this.addPrettyTextToSave(save)
        this.commitSave(save, slotId)
    }

    savePlayerState(username: string, player: ig.ENTITY.Player, mapName: string, marker?: Nullable<string>) {
        this.currentData ??= {}
        this.currentData.players ??= {}
        this.currentData.players[username] = {
            ...(player.getState!() as PlayerGetStateReturn),
            animAlpha: 1,

            mapName,
            marker,
        }
    }

    private savePlayerStates() {
        for (const map of multi.server.getActiveAndReadyMaps()) {
            runTask(map.inst, () => {
                for (const client of map.clients) {
                    if (!client.ready) continue

                    this.savePlayerState(client.username, client.dummy, map.name, client.marker)
                }
            })
        }
    }

    private saveData(): void {
        this.savePlayerStates()
    }

    getPlayerState(username: string): PlayerState | undefined {
        return this.currentData?.players?.[username]
    }

    load() {
        assert(multi.server instanceof PhysicsServer)
        const slotId = multi.server.settings.save?.loadFromSlot
        if (slotId === undefined) return

        ig.storage.lastUsedSlot = slotId
        const slot = ig.storage.getSlot(slotId)
        if (!slot) throw new Error(`Slot: ${slotId} not found!`)

        const data = slot.getData()
        ig.storage.currentLoadFile = data
        ig.storage.checkPointSave = data
    }
}

export function linkOptions(to: InstanceinatorInstance, from: InstanceinatorInstance) {
    to.sc.options.values = from.sc.options.values
}

declare global {
    namespace multi {
        var storage: MultiStorage
    }
}
prestart(() => {
    multi.storage = new MultiStorage()
})
poststart(() => {
    ig.storage.register(multi.storage)
})

prestart(() => {
    ig.Storage.inject({
        saveCheckpoint(mapName, position, loadHint) {
            if (!multi.server) return this.parent(mapName, position, loadHint)
        },
        save(slot) {
            if (!multi.server) return this.parent(slot)

            multi.storage.save(slot)
        },
        onLevelLoadStart(data) {
            multi.storage.wrapFilterListeners(() => {
                this.parent!(data)
            })
        },
        onLevelLoaded(data) {
            multi.storage.wrapFilterListeners(() => {
                this.parent!(data)
            })
        },
    })

    if (ASSERT) {
        ig.Storage.inject({
            _saveState(output, mapName, teleportPositionSettings) {
                if (multi.server) {
                    assert(multi.storage.saving)
                }
                return this.parent(output, mapName, teleportPositionSettings)
            },
        })
    }
})
