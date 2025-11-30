import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    function replace<T extends ig.StepBase>(this: T & { parent: T['start'] }, data: unknown, eventCall?: ig.EventCall) {
        if (!isPhysics(multi.server)) return this.parent(data, eventCall)

        if (ig.client) setNextSetBy(ig.game.playerEntity)

        this.parent(data, eventCall)

        unsetNextSetBy()
    }

    ig.EVENT_STEP.CHANGE_VAR_BOOL.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_VEC2.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_VEC3.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_NUMBER.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_STRING.inject({ start: replace })

    ig.ACTION_STEP.CHANGE_VAR_BOOL.inject({ start: replace })
    ig.ACTION_STEP.CHANGE_VAR_NUMBER.inject({ start: replace })
    ig.ACTION_STEP.CHANGE_VAR_STRING.inject({ start: replace })
})
