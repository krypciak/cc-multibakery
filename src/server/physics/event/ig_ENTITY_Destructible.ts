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
            const root = ballLike.getCombatantRoot()
            if (root instanceof dummy.DummyPlayer) this.lastHitByPlayer = root.netid
            return this.parent(ballLike, blockDir)
        },
        destroy: universalPlayerEntityFix(function () {
            return [ig.game.entitiesByNetid[this.lastHitByPlayer ?? -1]]
        }),
    })
})
