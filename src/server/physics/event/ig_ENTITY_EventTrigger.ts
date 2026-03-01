import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'
import { setEventNextTriggeredBy, unsetEventNextTriggeredBy } from './event-manager'
import { findSetByEntityByVars, setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.EventTrigger.inject({
        update() {
            if (!isPhysics(multi.server)) return this.parent()

            const setBy = findSetByEntityByVars(this.startCondition.vars)
            if (setBy) setNextSetBy(setBy)

            setEventNextTriggeredBy(this.startCondition)

            this.parent()

            unsetEventNextTriggeredBy()
            unsetNextSetBy()
        },
    })
})
