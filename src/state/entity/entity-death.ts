import { entityIgnoreDeath, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../../misc/entity-netid'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { addStateHandler, type StateKey } from '../states'
import type { RecordSize, u16, u4 } from 'ts-binarifier/src/type-aliases'

type EntityDeathsObj = Record<EntityNetid, u4>

declare global {
    interface StateUpdatePacket {
        entityDeaths?: EntityDeathsObj & RecordSize<u16>
    }
    namespace ig {
        interface MapSharedVars {
            entityDeaths?: EntityDeathsObj
            entityDeathsStateMemory?: StateMemory.MapHolder<StateKey>
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (!ig.mapShared.entityDeaths) return

            ig.mapShared.entityDeathsStateMemory ??= {}
            const memory = StateMemory.getBy(ig.mapShared.entityDeathsStateMemory, client)

            packet.entityDeaths = memory.diffRecord(ig.mapShared.entityDeaths)
        },
        set(packet) {
            if (!packet.entityDeaths) return

            for (const netid in packet.entityDeaths) {
                const entity = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    // console.warn('tried to kill entity', netid, 'but not found!')
                    continue
                }
                entity.kill()
            }
        },
    })

    if (!PHYSICSNET) return

    ig.Entity.inject({
        setNetid(override) {
            if (!shouldCollectStateData()) return this.parent(override)

            if (ig.mapShared.entityDeaths) delete ig.mapShared.entityDeaths[this.netid]
            this.parent(override)
            if (ig.mapShared.entityDeaths) delete ig.mapShared.entityDeaths[this.netid]
        },
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                const deaths = (ig.mapShared.entityDeaths ??= {})
                deaths[this.netid] = ((deaths[this.netid] ?? 0) + 1) % 16
            }
        },
    })
}, 3)
