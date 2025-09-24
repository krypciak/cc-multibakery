import { entityIgnoreDeath } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../entity'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { addStateHandler, StateKey } from '../states'

declare global {
    interface StateUpdatePacket {
        entityDeaths?: string[]
    }
    namespace ig {
        var entityDeaths: Set<string> | undefined
        var entityDeathsStateMemory: StateMemory.MapHolder<StateKey>
    }
}

prestart(() => {
    addStateHandler({
        get(packet, player) {
            if (!ig.entityDeaths) return

            ig.entityDeathsStateMemory ??= {}
            const memory = StateMemory.getBy(ig.entityDeathsStateMemory, player)

            packet.entityDeaths = memory.diffGrowingSet(ig.entityDeaths)
        },
        set(packet) {
            if (!packet.entityDeaths) return

            for (const netid of packet.entityDeaths) {
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
            ig.entityDeaths?.delete(this.netid)
            this.parent(x, y, z, settings)
            ig.entityDeaths?.delete(this.netid)
        },
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                ig.entityDeaths ??= new Set()
                ig.entityDeaths.add(this.netid)
            }
        },
    })
}, 3)
