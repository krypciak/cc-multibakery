import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { findSetByEntityByVars } from './vars'

declare global {
    namespace ig {
        interface EventManager {
            nextTriggeredBy?: ig.VarCondition
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
            const player = findSetByEntityByVars(this.nextTriggeredBy?.vars ?? [])
            if (!player) return this.parent(event, runType, onStart, onEnd, input, callEntity, data)

            assert(player instanceof dummy.DummyPlayer)
            const client = player.getClient()

            const prevId = instanceinator.id
            client.inst.apply()

            const eventCall = ig.game.events.callEvent(event, runType, onStart, onEnd, input, callEntity, data)

            instanceinator.instances[prevId].apply()

            return eventCall
        },
    })
})
