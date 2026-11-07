import { prestart } from '../../../loading-stages'
import { isPhysics } from '../physics-server-types'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if (!isPhysics(multi.server)) return this.parent(ball)

            try {
                if ('combatant' in ball && ball.combatant && ball.combatant instanceof ig.Entity)
                    setNextSetBy(ball.getCombatantRoot())

                return this.parent(ball)
            } finally {
                unsetNextSetBy()
            }
        },
    })
})
