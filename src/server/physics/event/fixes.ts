import { prestart } from '../../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../../misc/assert'

prestart(() => {
    if (!PHYSICS) return

    ig.EVENT_STEP.MANUAL_COMBATANT_KILL.inject({
        start(data, eventCall) {
            if (!multi.server || ig.ccmap) return this.parent(data, eventCall)

            assert(ig.client)
            return runTask(ig.client.getMap().inst, () => this.parent(data, eventCall))
        },
    })
})
