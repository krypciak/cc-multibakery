import { prestart } from '../../plugin'
import { setNextTriggeredBy, unsetNextTriggeredBy } from './event-manager'
import { findSetByEntityByVars, setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    ig.ENTITY.EventTrigger.inject({
        update() {
            const setBy = findSetByEntityByVars(this.startCondition.vars)
            if (setBy) setNextSetBy(setBy)

            setNextTriggeredBy(this.startCondition)

            this.parent()

            unsetNextTriggeredBy()
            unsetNextSetBy()
        },
    })
})
