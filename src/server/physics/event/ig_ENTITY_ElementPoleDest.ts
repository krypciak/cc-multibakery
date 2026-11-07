import { prestart } from '../../../loading-stages'
import type { EntityNetid } from '../../../misc/entity-netid'
import { isPhysics } from '../physics-server-types'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface ElementPoleDest {
            lastInteractPlayerNetid?: EntityNetid
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.ElementPoleDest.inject({
        onPoleHit(pole, ball, alreadyHit) {
            this.lastInteractPlayerNetid = ig.game.playerEntity?.netid
            return this.parent(pole, ball, alreadyHit)
        },
        turnOn() {
            if (!isPhysics(multi.server) || !this.lastInteractPlayerNetid) return this.parent()

            const entity = ig.game.entitiesByNetid[this.lastInteractPlayerNetid]
            if (!entity) return this.parent()

            try {
                setNextSetBy(entity)
                return this.parent()
            } finally {
                unsetNextSetBy()
            }
        },
    })
})
