import { prestart } from '../../plugin'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if (ball instanceof ig.ENTITY.Projectile && ball.combatant) setNextSetBy(ball.combatant)
            const ret = this.parent(ball)
            unsetNextSetBy()
            return ret
        },
    })
})
