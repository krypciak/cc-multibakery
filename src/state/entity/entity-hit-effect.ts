import { prestart } from '../../loading-stages'
import { shouldCollectStateData } from '../state-util'
import type { u16 } from 'ts-binarifier/src/type-aliases'
import type { EntityNetid } from '../../misc/entity-netid'
import { wrapIgnoreEffectNetid } from './effect-netid'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'

declare global {
    interface MapStateOrderedEvents {
        entityHitEffect: {
            type: 'entityHitEffect'
            netid: EntityNetid
            hitPos: Vec3
            hitDegree: sc.ATTACK_TYPE
            hitElement: sc.ELEMENT
            shieldResult: sc.SHIELD_RESULT
            critical: boolean
            ignoreSounds: boolean
            spriteFilter?: u16[]
        }
    }
}
registerOrderedEvent('entityHitEffect', {
    set({ netid, hitPos, hitDegree, hitElement, shieldResult, critical, ignoreSounds, spriteFilter }) {
        const entity = ig.game.entitiesByNetid[netid]
        if (!entity) return
        sc.combat.showHitEffect(
            entity,
            hitPos,
            hitDegree,
            hitElement,
            shieldResult,
            critical,
            ignoreSounds,
            spriteFilter
        )
    },
})

prestart(() => {
    if (!PHYSICSNET) return

    sc.Combat.inject({
        showHitEffect(entity, hitPos, hitDegree, hitElement, shieldResult, critical, ignoreSounds, spriteFilter) {
            if (!shouldCollectStateData()) {
                return this.parent(
                    entity,
                    hitPos,
                    hitDegree,
                    hitElement,
                    shieldResult,
                    critical,
                    ignoreSounds,
                    spriteFilter
                )
            }

            const handle = wrapIgnoreEffectNetid(() =>
                this.parent(entity, hitPos, hitDegree, hitElement, shieldResult, critical, ignoreSounds, spriteFilter)
            )

            if (entity.netid === undefined) {
                console.warn(
                    `sc.Combat#showHitEffect entity (${fcn(entity)}) is not an net entity! remote clients will crash!`
                )
            }
            pushOrderedEvent({
                type: 'entityHitEffect',
                netid: entity.netid,
                hitPos,
                hitDegree,
                hitElement,
                shieldResult,
                critical,
                ignoreSounds,
                spriteFilter,
            })
            return handle
        },
    })
}, 6)
