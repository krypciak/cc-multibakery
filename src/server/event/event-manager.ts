import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { findSetByEntityByVars } from './vars'
import * as inputBackup from '../../dummy/dummy-input'

declare global {
    namespace ig {
        interface EventManager {
            nextTriggeredBy?: ig.VarCondition
        }
        interface EventCall {
            triggeredByCond?: ig.VarCondition
            triggeredByEntity?: ig.Entity
        }
    }
}

export function setNextTriggeredBy(cond: ig.VarCondition) {
    assert(cond)
    ig.game.events.nextTriggeredBy = cond
}
export function unsetNextTriggeredBy() {
    ig.game.events.nextTriggeredBy = undefined
}

prestart(() => {
    ig.EventManager.inject({
        callEvent(event, runType, onStart, onEnd, input, callEntity, data) {
            const eventCall = this.parent(event, runType, onStart, onEnd, input, callEntity, data)

            eventCall.triggeredByCond = this.nextTriggeredBy
            eventCall.triggeredByEntity = findSetByEntityByVars(eventCall.triggeredByCond?.vars ?? [])

            return eventCall
        },
    })
})

prestart(() => {
    ig.EventCall.inject({
        performStep(stackEntry) {
            const player = this.triggeredByEntity
            if (!(player instanceof dummy.DummyPlayer)) return this.parent(stackEntry)

            inputBackup.apply(player.inputManager)
            const ret = this.parent(stackEntry)
            inputBackup.restore()
            return ret
        },
    })
})
