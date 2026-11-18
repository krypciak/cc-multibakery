import { prestart } from '../../../loading-stages'
import type { EntityNetid } from '../../../misc/entity-netid'
import { universalPlayerEntityFix } from '../../instance-redirect-fixes'

declare global {
    namespace ig.ENTITY {
        interface Destructible {
            lastHitByPlayer?: EntityNetid
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Destructible.inject({
        ballHit(ballLike, blockDir) {
            if (ig.client) this.lastHitByPlayer = ig.client.dummy.netid
            return this.parent(ballLike, blockDir)
        },
        destroy: universalPlayerEntityFix(function () {
            return [ig.game.entitiesByNetid[this.lastHitByPlayer ?? -1]]
        }),
    })
})
