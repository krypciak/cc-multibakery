import { prestart } from '../../loading-stages'
import { setNextSetBy, unsetNextSetBy } from './vars'

prestart(() => {
    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if ('combatant' in ball && ball.combatant && ball.combatant instanceof ig.Entity)
                setNextSetBy(ball.combatant)

            const ret = this.parent(ball)
            unsetNextSetBy()
            return ret
        },
    })
})
