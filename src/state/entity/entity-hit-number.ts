import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { shouldCollectStateData } from '../state-util'
import type { EntityNetid } from '../../misc/entity-netid'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'

prestart(() => {
    ig.ENTITY.HitNumber.forceRemotePhysics = true
    ig.ENTITY.HitNumberSum.forceRemotePhysics = true
})

/* hit number */
declare global {
    interface MapStateOrderedEvents {
        hitNumberSpawn: {
            type: 'hitNumberSpawn'
            netid: EntityNetid
            pos: Vec3
            damage: number
            size: number
            strength: number
            shieldResult?: sc.SHIELD_RESULT
            isCrit?: boolean
            weakness?: boolean
        }
    }
}
registerOrderedEvent('hitNumberSpawn', {
    set({ pos, netid, damage, size, strength, shieldResult, isCrit, weakness }) {
        if (!sc.options.get('damage-numbers') || sc.combat.hideDamageNumbers) return
        if (sc.options.get('damage-numbers-crit') && !isCrit) return

        const combatant = ig.game.entitiesByNetid[netid]
        if (!combatant) return
        assert(combatant instanceof ig.ENTITY.Combatant)

        spawnHitNumber(pos, combatant, damage, size, strength, shieldResult, isCrit, weakness)
    },
})

let spawnHitNumber: ig.ENTITY.HitNumberConstructor['spawnHitNumber']
prestart(() => {
    if (!PHYSICSNET) return
    spawnHitNumber = ig.ENTITY.HitNumber.spawnHitNumber

    ig.ENTITY.HitNumber.spawnHitNumber = function (
        pos,
        combatant,
        damage,
        size,
        strength,
        shieldResult,
        isCrit,
        weakness
    ) {
        if (shouldCollectStateData()) {
            const netid = combatant.netid
            assert(netid)
            pushOrderedEvent({
                type: 'hitNumberSpawn',
                pos,
                netid: netid,
                damage,
                size,
                strength,
                shieldResult,
                isCrit,
                weakness,
            })
        }

        return spawnHitNumber(pos, combatant, damage, size, strength, shieldResult, isCrit, weakness)
    }
})

/* heal number */
declare global {
    interface MapStateOrderedEvents {
        healNumberSpawn: {
            type: 'healNumberSpawn'
            netid: EntityNetid
            pos: Vec3
            healAmount: number
        }
    }
}
registerOrderedEvent('healNumberSpawn', {
    set({ pos, netid, healAmount }) {
        if (!sc.options.get('damage-numbers')) return

        const combatant = ig.game.entitiesByNetid[netid]
        if (!combatant) return
        assert(combatant instanceof ig.ENTITY.Combatant)

        spawnHealingNumber(pos, combatant, healAmount)
    },
})

let spawnHealingNumber: ig.ENTITY.HitNumberConstructor['spawnHealingNumber']
prestart(() => {
    if (!PHYSICSNET) return
    spawnHealingNumber = ig.ENTITY.HitNumber.spawnHealingNumber

    ig.ENTITY.HitNumber.spawnHealingNumber = function (pos, combatant, healAmount) {
        if (shouldCollectStateData()) {
            const netid = combatant.netid
            assert(netid)
            pushOrderedEvent({ type: 'healNumberSpawn', pos, netid, healAmount })
        }

        return spawnHealingNumber(pos, combatant, healAmount)
    }
})

/* hit number clear */
declare global {
    interface MapStateOrderedEvents {
        clearHitNumber: {
            type: 'clearHitNumber'
            netid: EntityNetid
        }
    }
}
registerOrderedEvent('clearHitNumber', {
    set({ netid }) {
        const combatant = ig.game.entitiesByNetid[netid]
        if (!combatant) return
        assert(combatant instanceof ig.ENTITY.Combatant)

        combatant.clearDamageSum()
    },
})
prestart(() => {
    if (PHYSICSNET) {
        ig.ENTITY.Combatant.inject({
            clearDamageSum() {
                this.parent()
                if (shouldCollectStateData()) {
                    assert(this.netid)
                    pushOrderedEvent({ type: 'clearHitNumber', netid: this.netid })
                }
            },
        })
    }
})
