import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if (!(multi.server instanceof PhysicsServer)) return this.parent(ball)

            if ('combatant' in ball && ball.combatant && ball.combatant instanceof ig.Entity)
                setNextSetBy(ball.combatant)

            const ret = this.parent(ball)
            unsetNextSetBy()
            return ret
        },
    })
})
