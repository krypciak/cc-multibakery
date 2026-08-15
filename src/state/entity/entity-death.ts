import { entityIgnoreDeath, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { getEntityTypeId } from '../../misc/entity-netid'
import { shouldCollectStateData } from '../state-util'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'

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
        const entity = ig.game.entitiesByNetid[netid]
        if (!entity) {
            // console.warn('tried to kill entity', netid, 'but not found!')
            return
        }
        entity.kill()
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
            }
        },
    })
})
