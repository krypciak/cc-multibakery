import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../../misc/assert'
import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'

declare global {
    namespace ig {
        var actionNextTriggeredBy: dummy.DummyPlayer | undefined

        interface ActorEntity {
            actionBoundToPlayer?: dummy.DummyPlayer
        }
    }
}

export function setActionNextTriggeredBy(player: dummy.DummyPlayer) {
    assert(player)
    ig.actionNextTriggeredBy = player
}

prestart(() => {
    if (!PHYSICS) return

    ig.ActorEntity.inject({
        setAction(action, keepState, noStateReset) {
            if (action && isPhysics(multi.server) && !(this instanceof dummy.DummyPlayer)) {
                const player = ig.actionNextTriggeredBy || ig.client?.dummy
                if (player) this.actionBoundToPlayer = player
            }
            return this.parent(action, keepState, noStateReset)
        },
        cancelAction(...args) {
            if (!this.currentAction || !this.actionBoundToPlayer) return this.parent(...args)

            const client = this.actionBoundToPlayer.getClient(true)
            if (!client) return this.parent(...args)
            return runTask(client.inst, () => this.parent(...args))
        },
    })

    ig.Action.inject({
        run(actor) {
            if (!actor.actionBoundToPlayer) return this.parent(actor)

            const client = actor.actionBoundToPlayer.getClient(true)
            if (!client) return this.parent(actor)
            return runTask(client.inst, () => this.parent(actor))
        },
    })
}, 1001) /* inject after action-history.ts */
