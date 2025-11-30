import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../../misc/assert'
import { prestart } from '../../../loading-stages'
import { findSetByEntityByVars } from './vars'
import { isPhysics } from '../is-physics-server'

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

function isConditionTriggeredAtMapEnter(code: string): boolean {
    return code == 'true' || code.startsWith('plot.line')
}

prestart(() => {
    if (!PHYSICS) return

    ig.EventManager.inject({
        callEvent(...args) {
            if (!isPhysics(multi.server)) return this.parent(...args)

            let player: ig.Entity | undefined
            if (this.nextTriggeredBy) {
                player = findSetByEntityByVars(this.nextTriggeredBy?.vars ?? [])
                if (!player && isConditionTriggeredAtMapEnter(this.nextTriggeredBy.pretty)) {
                    assert(ig.ccmap)
                    assert(ig.ccmap.clients.length > 0)
                    const pl = ig.ccmap.clients[0]
                    assert(pl.ready)
                    assert(pl.dummy)
                    player = pl.dummy
                }
            }
            if (!player) return this.parent(...args)

            assert(player instanceof dummy.DummyPlayer)
            const client = player.getClient(true)
            if (!client) return this.parent(...args)

            return runTask(client.inst, () => ig.game.events.callEvent(...args))
        },
    })
})
