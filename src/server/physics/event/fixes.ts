import { prestart } from '../../../loading-stages'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../../misc/assert'

prestart(() => {
    if (!PHYSICS) return

    function runStepOnMap<T extends ig.EventStepBase>(
        this: T & { parent: (data?: unknown, eventCall?: ig.EventCall) => void },
        data?: unknown,
        eventCall?: ig.EventCall
    ) {
        if (!multi.server || ig.ccmap) return this.parent(data, eventCall)

        assert(ig.client)
        return runTask(ig.client.getMap().inst, () => this.parent(data, eventCall))
    }

    ig.EVENT_STEP.MANUAL_COMBATANT_KILL.inject({ start: runStepOnMap })
    ig.EVENT_STEP.ADD_PARTY_MEMBER.inject({ start: runStepOnMap })
})
