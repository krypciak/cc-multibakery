import { entityIgnoreDeath, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../../misc/entity-netid'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { addStateHandler, type StateKey } from '../states'
import { type RecordSize, type u16, type u4 } from 'ts-binarifier/src/type-aliases'
import { runTaskInMapInst } from '../../client/client'

type EntityDeathsObj = Record<EntityNetid, u4>

declare global {
    interface StateUpdatePacket {
        entityDeaths?: EntityDeathsObj & RecordSize<u16>
    }
    namespace ig {
        var entityDeaths: EntityDeathsObj | undefined
        var entityDeathsStateMemory: StateMemory.MapHolder<StateKey>
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (!ig.entityDeaths) return

            ig.entityDeathsStateMemory ??= {}
            const memory = StateMemory.getBy(ig.entityDeathsStateMemory, client)

            packet.entityDeaths = memory.diffRecord(ig.entityDeaths)
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
            if (ig.entityDeaths) delete ig.entityDeaths[this.netid]
            this.parent(override)
            if (ig.entityDeaths) delete ig.entityDeaths[this.netid]
        },
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                runTaskInMapInst(() => {
                    ig.entityDeaths ??= {}
                    ig.entityDeaths[this.netid] = ((ig.entityDeaths[this.netid] ?? 0) + 1) % 16
                })
            }
        },
    })
}, 3)
