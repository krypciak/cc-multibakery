import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../../physics/physics-server'
import { setNextTriggeredBy, unsetNextTriggeredBy } from './event-manager'
import { findSetByEntityByVars, setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!(multi.server instanceof PhysicsServer)) return this.parent()

            const setBy = findSetByEntityByVars(this.startCondition.vars)
            if (setBy) setNextSetBy(setBy)

            setNextTriggeredBy(this.startCondition)

            this.parent()

            unsetNextTriggeredBy()
            unsetNextSetBy()
        },
    })
})
