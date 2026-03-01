import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    function replace<T extends ig.StepBase, R>(this: T & { parent: T['start'] }, ...args: unknown[]): R {
        if (!isPhysics(multi.server)) return this.parent(...args) as R

        if (ig.client?.dummy) setNextSetBy(ig.client.dummy)

        const ret = this.parent(...args)

        unsetNextSetBy()

        return ret as R
    }

    ig.EVENT_STEP.CHANGE_VAR_BOOL.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_VEC2.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_VEC3.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_NUMBER.inject({ start: replace })
    ig.EVENT_STEP.CHANGE_VAR_STRING.inject({ start: replace })

    ig.ACTION_STEP.CHANGE_VAR_BOOL.inject({ run: replace })
    ig.ACTION_STEP.CHANGE_VAR_NUMBER.inject({ run: replace })
    ig.ACTION_STEP.CHANGE_VAR_STRING.inject({ run: replace })
})
