import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData } from '../state-util'
import { addStateHandler } from '../states'
import { u16 } from 'ts-binarifier/src/type-aliases'
import { EntityNetid } from '../../misc/entity-netid'

interface HitConfig {
    entity: EntityNetid
    hitPos: Vec3
    hitDegree: sc.ATTACK_TYPE
    hitElement: sc.ELEMENT
    shielded: boolean
    critical: boolean
    ignoreSounds: boolean
    spriteFilter?: u16[]
}

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
        },
        clear() {
            ig.entityHitPackets = undefined
        },
        set(packet) {
            if (!packet.entityHitPackets) return

            for (const {
                entity: entityNetid,
                hitPos,
                hitDegree,
                hitElement,
                shielded,
                critical,
                ignoreSounds,
                spriteFilter,
            } of packet.entityHitPackets) {
                const entity = ig.game.entitiesByNetid[entityNetid]
                assert(entity)
                sc.combat.showHitEffect(
                    entity,
                    hitPos,
                    hitDegree,
                    hitElement,
                    shielded,
                    critical,
                    ignoreSounds,
                    spriteFilter
                )
            }
        },
    })

    if (!PHYSICSNET) return

    sc.Combat.inject({
        showHitEffect(entity, hitPos, hitDegree, hitElement, shielded, critical, ignoreSounds, spriteFilter) {
            if (!shouldCollectStateData())
                return this.parent(
                    entity,
                    hitPos,
                    hitDegree,
                    hitElement,
                    shielded,
                    critical,
                    ignoreSounds,
                    spriteFilter
                )

            ig.ignoreEffectNetid = true
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
            ig.ignoreEffectNetid = false

            assert(entity.netid)
            ig.entityHitPackets ??= []
            ig.entityHitPackets.push({
                entity: entity.netid,
                hitPos,
                hitDegree,
                hitElement,
                shielded,
                critical,
                ignoreSounds,
                spriteFilter,
            })

            return handle
        },
    })
}, 6)
