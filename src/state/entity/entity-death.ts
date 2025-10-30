import { entityIgnoreDeath } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../entity'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { addStateHandler, StateKey } from '../states'
import { u4 } from 'ts-binarifier/src/type-aliases'

type EntityDeathsObj = Record<string, u4>

declare global {
    interface StateUpdatePacket {
        entityDeaths?: EntityDeathsObj
    }
    namespace ig {
        var entityDeaths: EntityDeathsObj | undefined
        var entityDeathsStateMemory: StateMemory.MapHolder<StateKey>
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            if (!ig.entityDeaths) return

            ig.entityDeathsStateMemory ??= {}
            const memory = StateMemory.getBy(ig.entityDeathsStateMemory, player)

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
        setNetid(x, y, z, settings) {
            if (ig.entityDeaths) delete ig.entityDeaths[this.netid]
            this.parent(x, y, z, settings)
            if (ig.entityDeaths) delete ig.entityDeaths[this.netid]
        },
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                ig.entityDeaths ??= {}
                ig.entityDeaths[this.netid] = ((ig.entityDeaths[this.netid] ?? 0) + 1) % 16
            }
        },
    })
}, 3)
