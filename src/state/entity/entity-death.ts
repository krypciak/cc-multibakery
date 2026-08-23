import { entityIgnoreDeath, entityTemporary, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../../misc/entity-netid'
import { shouldCollectStateData, StateMemory } from '../state-util'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'
import type { RecordSize, u16 } from 'ts-binarifier/src/type-aliases'
import type { MapStateHandler, StateKey } from '../map-state-handlers'

function killEntity(netid: EntityNetid) {
    const entity = ig.game.entitiesByNetid[netid]
    if (!entity) {
        // console.warn('tried to kill entity', netid, 'but not found!')
        return
    }
    entity.kill()
}

declare global {
    interface MapStateOrderedEvents {
        entityDeath: {
            type: 'entityDeath'
            /* named netid1 instead of netid to avoid ts-binarifier error */
            netid1: EntityNetid
        }
    }
}
registerOrderedEvent('entityDeath', {
    set({ netid1: netid }) {
        killEntity(netid)
    },
})

prestart(() => {
    if (!PHYSICSNET) return

    ig.Entity.inject({
        kill(levelChange) {
            this.parent(levelChange)
            if (!this.netid) return
            const typeId = getEntityTypeId(this.netid)
            if (entityIgnoreDeath.has(typeId)) return

            if (shouldCollectStateData()) {
                pushOrderedEvent({ type: 'entityDeath', netid1: this.netid })

                if (!entityTemporary.has(typeId)) {
                    const deaths = (ig.mapShared.entityDeaths ??= {})
                    deaths[this.netid] = true
                }
            }
        },
    })
})

/* also track non-temporary entity deaths in a record
 * for remote clients that join the map later know it's dead */
declare global {
    interface StateUpdatePacket {
        entityDeaths?: Record<EntityNetid, true> & RecordSize<u16>
    }
    namespace ig {
        interface MapSharedVars {
            entityDeaths?: Record<EntityNetid, true>
            entityDeathsStateMemory?: StateMemory.MapHolder<StateKey>
        }
    }
}

export const entityDeathMapStateHandler: MapStateHandler = {
    get(packet, client) {
        if (!ig.mapShared.entityDeaths) return

        ig.mapShared.entityDeathsStateMemory ??= {}
        const memory = StateMemory.getBy(ig.mapShared.entityDeathsStateMemory, client)

        /* important! only do this when entering a map! */
        if (memory.onlyOnce(true)) {
            packet.entityDeaths = memory.diffRecord(ig.mapShared.entityDeaths)
        }
    },
    set(packet) {
        if (!packet.entityDeaths) return

        for (const netid in packet.entityDeaths) {
            killEntity(parseInt(netid) as EntityNetid)
        }
    },
}
