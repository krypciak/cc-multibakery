import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { isPhysics } from '../physics-server-types'
import type { Client } from '../../../client/client'

declare global {
    namespace ig {
        interface ActorEntity {
            actionBoundToPlayer?: dummy.DummyPlayer

            getClientFromBoundAction(this: this): Client | undefined
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ActorEntity.inject({
        getClientFromBoundAction() {
            let client = this.actionBoundToPlayer?.getClient(true)
            if (!client?.ready) client = ig.mapShared.ccmap.clients.find(client => client.ready)
            if (!client?.ready) return
            if (client.tpInfo.map != ig.game.mapName) {
                this.actionBoundToPlayer = undefined
                return
            }
            return client
        },
        setAction(action, keepState, noStateReset) {
            if (action && isPhysics(multi.server) && !(this instanceof dummy.DummyPlayer)) {
                let player = ig.client?.dummy
                if (!player && this instanceof sc.BasicCombatant) {
                    const root = this.getCombatantRoot()
                    if (root instanceof dummy.DummyPlayer) player = root
                }
                if (player) this.actionBoundToPlayer = player
            }
            return this.parent(action, keepState, noStateReset)
        },
        cancelAction(...args) {
            if (!this.currentAction || !this.actionBoundToPlayer) return this.parent(...args)

            const client = this.getClientFromBoundAction()
            if (!client) return this.parent(...args)
            return runTask(client.inst, () => this.parent(...args))
        },
    })

    ig.Action.inject({
        run(actor) {
            if (!actor.actionBoundToPlayer) return this.parent(actor)

            const client = actor.getClientFromBoundAction()
            if (!client) return this.parent(actor)
            return runTask(client.inst, () => this.parent(actor))
        },
    })
}, 1001) /* inject after action-history.ts */
