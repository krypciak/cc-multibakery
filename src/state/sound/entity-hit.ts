import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { PhysicsServer } from '../../server/physics/physics-server'
import { createFakeEffectSheet } from '../entity'
import { addStateHandler } from '../states'

/*                entity hitPos hitDegree       hitElement  shielded */
type HitConfig = [string, Vec3, sc.ATTACK_TYPE, sc.ELEMENT, boolean]

declare global {
    interface StateUpdatePacket {
        entityHitPackets?: HitConfig[]
    }
    namespace ig {
        var entityHitPackets: HitConfig[] | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.entityHitPackets = ig.entityHitPackets
            ig.entityHitPackets = undefined
        },
        set(packet) {
            if (!packet.entityHitPackets) return

            const backupEffects = sc.combat.effects
            sc.combat.effects = {
                hit: createFakeEffectSheet(),
                guard: createFakeEffectSheet(),
            } as any

            for (const [entityNetid, hitPos, hitDegree, hitElement, shielded] of packet.entityHitPackets) {
                const entity = ig.game.entitiesByNetid[entityNetid]
                assert(entity)
                sc.combat.showHitEffect(entity, hitPos, hitDegree, hitElement, shielded, false, false)
            }

            sc.combat.effects = backupEffects
        },
    })

    if (!PHYSICS) return

    sc.Combat.inject({
        showHitEffect(entity, hitPos, hitDegree, hitElement, shielded, critical, ignoreSounds, spriteFilter) {
            const handle = this.parent(
                entity,
                hitPos,
                hitDegree,
                hitElement,
                shielded,
                critical,
                ignoreSounds,
                spriteFilter
            )
            if (!ignoreSounds && multi.server instanceof PhysicsServer) {
                assert(entity.netid)
                ig.entityHitPackets ??= []
                ig.entityHitPackets.push([entity.netid, hitPos, hitDegree, hitElement, shielded])
            }

            return handle
        },
    })
})
