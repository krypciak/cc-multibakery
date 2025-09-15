import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'

interface HitNumberConfig {
    isHealing?: boolean
    pos: Vec3
    combatant: string
    damage: number
    size?: number
    strength?: number
    shieldResult?: sc.SHIELD_RESULT
    isCrit?: boolean
    appenix?: sc.HIT_NUMBER_APPENDIX[]
}

declare global {
    interface StateUpdatePacket {
        hitNumber?: HitNumberConfig[]
    }
    namespace ig {
        var hitNumberSpawned: HitNumberConfig[] | undefined
    }
}

prestart(() => {
    const { spawnHitNumber, spawnHealingNumber } = ig.ENTITY.HitNumber

    addStateHandler({
        get(packet) {
            packet.hitNumber = ig.hitNumberSpawned
        },
        clear() {
            ig.hitNumberSpawned = undefined
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
                appenix,
            } of packet.hitNumber) {
                const combatant = ig.game.entitiesByNetid[combatantNetid]
                assert(combatant)
                assert(combatant instanceof ig.ENTITY.Combatant)

                if (isHealing) {
                    spawnHealingNumber(pos, combatant, damage)
                } else {
                    if (!onlyShowCrit || isCrit) {
                        spawnHitNumber(pos, combatant, damage, size!, strength!, shieldResult, isCrit, appenix)
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
            appenix
        ) {
            if (shouldCollectStateData()) {
                ig.hitNumberSpawned ??= []
                const netid = combatant.netid
                assert(netid)
                ig.hitNumberSpawned.push({
                    pos,
                    combatant: netid,
                    damage,
                    size,
                    strength,
                    shieldResult,
                    isCrit,
                    appenix: appenix ? appenix : undefined,
                })
            }

            return spawnHitNumber(pos, combatant, damage, size, strength, shieldResult, isCrit, appenix)
        }

        ig.ENTITY.HitNumber.spawnHealingNumber = function (pos, combatant, healAmount) {
            if (shouldCollectStateData()) {
                ig.hitNumberSpawned ??= []
                const netid = combatant.netid
                assert(netid)
                ig.hitNumberSpawned.push({
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
        hitNumberClear?: string[]
    }
    namespace ig {
        var hitNumberClear: string[] | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.hitNumberClear = ig.hitNumberClear
        },
        clear() {
            ig.hitNumberClear = undefined
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
                    ig.hitNumberClear ??= []
                    assert(this.netid)
                    ig.hitNumberClear.push(this.netid)
                }
            },
        })
    }
})
