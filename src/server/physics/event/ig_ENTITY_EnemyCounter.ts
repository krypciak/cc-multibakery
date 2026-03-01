import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface EnemyCounter {
            lastCausalEntity?: ig.Entity
        }
    }
}
prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.EnemyCounter.inject({
        onCombatEvent(combatant, type) {
            const entity = combatant.getLastDamagingEntity()
            if (entity) this.lastCausalEntity = entity
            if (!isPhysics(multi.server) || !entity || ig.vars.nextSetBy.length > 0) return this.parent(combatant, type)

            setNextSetBy(entity)
            const ret = this.parent(combatant, type)
            unsetNextSetBy()
            return ret
        },
        decreaseCount() {
            const entity = this.lastCausalEntity
            if (!isPhysics(multi.server) || !entity) return this.parent()

            setNextSetBy(entity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
