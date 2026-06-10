import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'
import type { EntityNetid } from '../misc/entity-netid'

interface HitNumberConfig {
    isHealing?: boolean
    pos: Vec3
    combatant: EntityNetid
    damage: number
    size?: number
    strength?: number
    shieldResult?: sc.SHIELD_RESULT
    isCrit?: boolean
    appendix?: sc.HIT_NUMBER_APPENDIX[]
}

declare global {
    interface StateUpdatePacket {
        hitNumber?: HitNumberConfig[]
    }
    namespace ig {
        interface MapSharedVars {
            hitNumberSpawned?: HitNumberConfig[]
        }
    }
}

prestart(() => {
    const { spawnHitNumber, spawnHealingNumber } = ig.ENTITY.HitNumber

    addStateHandler({
        get(packet) {
            packet.hitNumber = ig.mapShared.hitNumberSpawned
        },
        clear() {
            ig.mapShared.hitNumberSpawned = undefined
        },
        set(packet) {
            if (!packet.hitNumber) return
            if (!sc.options.get('damage-numbers') || sc.combat.hideDamageNumbers) return

            const onlyShowCrit = sc.options.get('damage-numbers-crit')

            for (const {
                isHealing,
                pos,
                combatant: combatantNetid,
                damage,
                size,
                strength,
                shieldResult,
                isCrit,
                appendix,
            } of packet.hitNumber) {
                const combatant = ig.game.entitiesByNetid[combatantNetid]
                assert(combatant)
                assert(combatant instanceof ig.ENTITY.Combatant)

                if (isHealing) {
                    spawnHealingNumber(pos, combatant, damage)
                } else {
                    if (!onlyShowCrit || isCrit) {
                        spawnHitNumber(pos, combatant, damage, size!, strength!, shieldResult, isCrit, appendix)
                    }
                }
            }
        },
    })

    ig.ENTITY.HitNumber.forceRemotePhysics = true
    ig.ENTITY.HitNumberSum.forceRemotePhysics = true

    if (PHYSICSNET) {
        ig.ENTITY.HitNumber.spawnHitNumber = function (
            pos,
            combatant,
            damage,
            size,
            strength,
            shieldResult,
            isCrit,
            appendix
        ) {
            if (shouldCollectStateData()) {
                ig.mapShared.hitNumberSpawned ??= []
                const netid = combatant.netid
                assert(netid)
                ig.mapShared.hitNumberSpawned.push({
                    pos,
                    combatant: netid,
                    damage,
                    size,
                    strength,
                    shieldResult,
                    isCrit,
                    appendix: appendix ? appendix : undefined,
                })
            }

            return spawnHitNumber(pos, combatant, damage, size, strength, shieldResult, isCrit, appendix)
        }

        ig.ENTITY.HitNumber.spawnHealingNumber = function (pos, combatant, healAmount) {
            if (shouldCollectStateData()) {
                ig.mapShared.hitNumberSpawned ??= []
                const netid = combatant.netid
                assert(netid)
                ig.mapShared.hitNumberSpawned.push({
                    isHealing: true,
                    pos,
                    combatant: netid,
                    damage: healAmount,
                })
            }

            return spawnHealingNumber(pos, combatant, healAmount)
        }
    }
})

declare global {
    interface StateUpdatePacket {
        hitNumberClear?: EntityNetid[]
    }
    namespace ig {
        interface MapSharedVars {
            hitNumberClear?: EntityNetid[]
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.hitNumberClear = ig.mapShared.hitNumberClear
        },
        clear() {
            ig.mapShared.hitNumberClear = undefined
        },
        set(packet) {
            if (!packet.hitNumberClear) return

            for (const netid of packet.hitNumberClear) {
                const combatant = ig.game.entitiesByNetid[netid]
                if (!combatant) continue
                assert(combatant instanceof ig.ENTITY.Combatant)

                combatant.clearDamageSum()
            }
        },
    })

    if (PHYSICSNET) {
        ig.ENTITY.Combatant.inject({
            clearDamageSum() {
                this.parent()
                if (shouldCollectStateData()) {
                    assert(this.netid)
                    ig.mapShared.hitNumberClear ??= []
                    ig.mapShared.hitNumberClear.push(this.netid)
                }
            },
        })
    }
})
