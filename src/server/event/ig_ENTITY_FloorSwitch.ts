import { prestart } from '../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface FloorSwitch {
            tmpEntity?: ig.Entity
        }
    }
}

prestart(() => {
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
            if (!this.isOn) setNextSetBy(this.tmpEntity!)
            this.parent(noDelay)
            unsetNextSetBy()
        },
    })
})
