import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface FloorSwitch {
            tmpEntity?: ig.Entity
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.FloorSwitch.inject({
        collideWith(entity) {
            this.tmpEntity = entity
            this.parent(entity)
            this.tmpEntity = undefined
        },
        onGroundAdd(entity) {
            this.tmpEntity = entity
            this.parent(entity)
            this.tmpEntity = undefined
        },
        activate(noDelay) {
            if (!(multi.server instanceof PhysicsServer)) return this.parent(noDelay)
            if (!this.isOn) setNextSetBy(this.tmpEntity!)
            this.parent(noDelay)
            unsetNextSetBy()
        },
    })
})
