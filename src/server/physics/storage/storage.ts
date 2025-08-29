import { runTask } from 'cc-instanceinator/src/inst-util'
import { poststart, prestart } from '../../../loading-stages'
import type { getState } from '../../../state/entity/ig_ENTITY_Player-base'
import { PhysicsServer } from '../physics-server'
import { assert } from '../../../misc/assert'

import './save-slot-button'
import './pause-screen-save-button'

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
        if (!multi.server.settings.saveToSaveFile) return

        this.currentData = savefile.multibakery ??= {}
        this.saveData()
    }

    onStoragePostLoad(this: this, savefile: ig.SaveSlot.Data): void {
        this.currentData = savefile.multibakery
    }

    private addPrettyTextToSave(save: ig.SaveSlot.Data, setDefaultData: boolean) {
        if (setDefaultData) {
            save.area = { en_US: 'Multibakery server', langUid: 1 }
            save.specialMap = { en_US: 'None', langUid: 1 }
        }

        if (multi.server.masterUsername) {
            const specialMap = save.specialMap as Record<string, string>
            const suffix = '\\c[0])'

            for (const key in specialMap) {
                if (typeof specialMap[key] != 'string') continue
                if (specialMap[key].endsWith(suffix)) continue

                specialMap[key] += ` (player: \\c[3]${multi.server.masterUsername}${suffix}`
            }
        }
    }

    private getSaveData() {
        const masterInstance = multi.server.masterUsername
            ? multi.server.clients[multi.server.masterUsername].inst
            : multi.server.serverInst

        assert(masterInstance)

        const partialSave: Partial<ig.SaveSlot.Data> = {}
        runTask(masterInstance, () => {
            const listenersBackup = ig.storage.listeners
            const relevantListeners = ig.storage.listeners.filter(
                listener => !('_instanceId' in listener) || listener._instanceId == instanceinator.id
            )
            ig.storage.listeners = relevantListeners

            this.saving = true
            ig.storage._saveState(partialSave, ig.game.mapName ?? 'multibakery/dev')
            this.saving = false

            ig.storage.listeners = listenersBackup
        })
        return partialSave as ig.SaveSlot.Data
    }

    private commitSave(save: ig.SaveSlot.Data, slotId?: number) {
        const saveSlot = new ig.SaveSlot(save)

        ig.storage.autoSlot = saveSlot
        ig.storage.checkPointSave = save
        ig.storage.lastUsedSlot = -1

        if (slotId !== undefined && multi.server instanceof PhysicsServer && multi.server.settings.saveToSaveFile) {
            ig.storage.slots[slotId] && ig.storage.slots.splice(slotId, 1)
            ig.storage.slots.unshift(saveSlot)
            ig.storage.lastUsedSlot = 0
            ig.storage._saveToStorage()
        }
    }

    save(slotId?: number) {
        const save = this.getSaveData()
        this.addPrettyTextToSave(save, !multi.server.masterUsername)
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
        for (const mapName in multi.server.maps) {
            const map = multi.server.maps[mapName]
            runTask(map.inst, () => {
                for (const player of ig.game.entities) {
                    if (!(player instanceof dummy.DummyPlayer)) continue

                    const client = player.getClient()
                    if (!client.player.ready) return

                    this.savePlayerState(client.player.username, player, mapName, client.player.marker)
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
