import { runTask } from 'cc-instanceinator/src/inst-util'
import { poststart, prestart } from '../../../loading-stages'
import type { getState } from '../../../state/entity/ig_ENTITY_Player-base'
import { PhysicsServer } from '../physics-server'
import { assert } from '../../../misc/assert'
import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { MapTpInfo } from '../../server'
import { Username } from '../../../net/binary/binary-types'

import './save-slot-button'
import './pause-screen-save-button'

type PlayerGetStateReturn = ReturnType<typeof getState>
type PlayerState = PlayerGetStateReturn & MapTpInfo

export interface MultibakerySaveData {
    players?: Record<Username, PlayerState>
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

    wrapFilterListeners<T>(func: () => T): T {
        const listenersBackup = ig.storage.listeners

        const instId = ig.client?.getMap().inst.id ?? instanceinator.id
        let relevantListeners = ig.storage.listeners.filter(
            listener => !('_instanceId' in listener) || listener._instanceId == instId
        )

        if (ig.client) {
            const clientListeners = [sc.map, sc.party, sc.message, sc.menu, sc.model]
            relevantListeners = relevantListeners.filter(
                l => !('classId' in l) || clientListeners.every(cl => l.classId != cl.classId)
            )
            relevantListeners.push(...clientListeners)
        }

        ig.storage.listeners = relevantListeners

        const ret = func()

        ig.storage.listeners = listenersBackup

        return ret
    }

    getSaveSlotData(): ig.SaveSlot.Data {
        const partialSave: Partial<ig.SaveSlot.Data> = {}
        this.saving = true
        ig.storage._saveState(partialSave, ig.game.mapName ?? 'multibakery/dev')
        this.saving = false
        return partialSave as ig.SaveSlot.Data
    }

    private getMultiSaveSlotData() {
        const masterInstance = multi.server.getMasterClient()?.inst ?? multi.server.inst
        assert(masterInstance)

        return runTask(masterInstance, () => {
            return this.wrapFilterListeners(() => this.getSaveSlotData())
        })
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
        const save = this.getMultiSaveSlotData()
        this.addPrettyTextToSave(save)
        this.commitSave(save, slotId)
    }

    savePlayerState(username: Username, player: ig.ENTITY.Player, tpInfo: MapTpInfo): PlayerState {
        this.currentData ??= {}
        this.currentData.players ??= {}
        return (this.currentData.players[username] = {
            ...(player.getState!() as PlayerGetStateReturn),
            animAlpha: 1,
            ...tpInfo,
        })
    }

    private savePlayerStates() {
        for (const map of multi.server.getActiveAndReadyMaps()) {
            runTask(map.inst, () => {
                for (const client of map.clients) {
                    if (!client.ready) continue

                    this.savePlayerState(client.username, client.dummy, client.tpInfo)
                }
            })
        }
    }

    private saveData(): void {
        this.savePlayerStates()
    }

    getPlayerState(username: Username): PlayerState | undefined {
        return this.currentData?.players?.[username]
    }

    private loadSlotData(data: ig.SaveSlot.Data) {
        ig.storage.currentLoadFile = data
        ig.storage.checkPointSave = data
        ig.vars.restoreFromJson(data.vars)
        sc.map.onStoragePreLoad(data)
        // @ts-expect-error
        sc.lore.onStoragePreLoad(data)
        sc.trade.onStoragePreLoad(data)
        sc.menu.onStoragePreLoad(data)
        sc.newgame.onStoragePreLoad(data)
        sc.timers.onStoragePreLoad(data)
    }

    load() {
        assert(multi.server instanceof PhysicsServer)
        const settings = multi.server.settings.save
        if (!settings) return

        let data: ig.SaveSlot.Data | undefined

        if (settings.loadSaveData) {
            data = settings.loadSaveData
        } else if (settings.loadFromSlot !== undefined) {
            const slotId = settings.loadFromSlot

            ig.storage.lastUsedSlot = slotId
            const slot = ig.storage.getSlot(slotId)
            if (!slot) throw new Error(`Slot: ${slotId} not found!`)

            data = slot.getData()
        }

        if (data) {
            this.loadSlotData(data)
        }
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
            if (ig.ccmap || ig.client) return
            multi.storage.wrapFilterListeners(() => {
                this.parent!(data)
            })
        },
        onLevelLoaded(data) {
            if (ig.ccmap || ig.client) return
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
