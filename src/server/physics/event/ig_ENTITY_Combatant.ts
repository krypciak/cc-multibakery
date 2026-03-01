import { prestart } from '../../../loading-stages'
import { assert } from '../../../misc/assert'
import type { EntityNetid } from '../../../misc/entity-netid'
import { isPhysics } from '../is-physics-server'
import { setActionNextTriggeredBy, unsetActionNextTriggeredBy } from './action-manager'
import { setNextSetBy, unsetNextSetBy } from './vars'

declare global {
    namespace ig.ENTITY {
        interface Combatant {
            lastDamagedNetid?: EntityNetid
            lastDamagedNetidPlayer?: EntityNetid

            getLastDamagingEntity(this: this): ig.Entity | undefined
            getLastDamagingPlayer(this: this): dummy.DummyPlayer | undefined
        }
    }
}
prestart(() => {
    if (!PHYSICS) return

    ig.ENTITY.Combatant.inject({
        onDamage(damagingEntity, attackInfo, animPart) {
            const root = damagingEntity.getCombatantRoot()
            if (root) {
                this.lastDamagedNetid = root.netid
                if (root instanceof dummy.DummyPlayer) {
                    this.lastDamagedNetidPlayer = root.netid
                    setActionNextTriggeredBy(root)
                } else if (this instanceof dummy.DummyPlayer) {
                    setActionNextTriggeredBy(this)
                }
            }
            const ret = this.parent(damagingEntity, attackInfo, animPart)
            unsetActionNextTriggeredBy()

            return ret
        },
        getLastDamagingEntity() {
            if (this.lastDamagedNetid) return ig.game.entitiesByNetid[this.lastDamagedNetid]
        },
        getLastDamagingPlayer() {
            if (this.lastDamagedNetidPlayer) {
                const player = ig.game.entitiesByNetid[this.lastDamagedNetidPlayer]
                assert(player instanceof dummy.DummyPlayer)
                return player
            }
        },
        selfDestruct(resolveDefeat) {
            const entity = this.getLastDamagingEntity()
            if (!isPhysics(multi.server) || !entity) return this.parent(resolveDefeat)

            setNextSetBy(entity)
            this.parent(resolveDefeat)
            unsetNextSetBy()
        },
        update() {
            const entity = this.getLastDamagingEntity()
            if (!isPhysics(multi.server) || !entity) return this.parent()

            setNextSetBy(entity)
            this.parent()
            unsetNextSetBy()
        },
    })
})
