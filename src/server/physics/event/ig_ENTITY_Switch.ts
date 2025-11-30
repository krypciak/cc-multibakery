import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if (!isPhysics(multi.server)) return this.parent(ball)

            if ('combatant' in ball && ball.combatant && ball.combatant instanceof ig.Entity)
                setNextSetBy(ball.getCombatantRoot())

            const ret = this.parent(ball)
            unsetNextSetBy()
            return ret
        },
    })
})
