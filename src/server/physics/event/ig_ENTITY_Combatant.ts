import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../physics-server'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface Combatant {
            lastDamagedNetid?: string
        }
    }
}
prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Combatant.inject({
        onDamage(damagingEntity, attackInfo, animPart) {
            this.lastDamagedNetid = damagingEntity.getCombatantRoot()?.netid
            return this.parent(damagingEntity, attackInfo, animPart)
        },
        selfDestruct(resolveDefeat) {
            const entity = this.lastDamagedNetid && ig.game.entitiesByNetid[this.lastDamagedNetid]
            if (!(multi.server instanceof PhysicsServer) || !entity) return this.parent(resolveDefeat)

            setNextSetBy(entity)
            this.parent(resolveDefeat)
            unsetNextSetBy()
        },
        update() {
            const entity = this.lastDamagedNetid && ig.game.entitiesByNetid[this.lastDamagedNetid]
            if (!(multi.server instanceof PhysicsServer) || !entity) return this.parent()

            setNextSetBy(entity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
