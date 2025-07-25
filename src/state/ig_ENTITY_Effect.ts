import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { PhysicsServer } from '../server/physics/physics-server'
import { RemoteServer } from '../server/remote/remote-server'
import { addStateHandler } from './states'
import { undefinedIfFalsy, undefinedIfVec3Zero } from './state-util'
import { TemporarySet } from '../misc/temporary-set'

declare global {
    namespace ig.ENTITY {
        interface Effect {
            sentEver?: boolean
        }
    }
    namespace ig {
        var ignoreEffectNetid: boolean | undefined
    }
}

type Return = Exclude<ReturnType<typeof getState>, undefined>
function getState(this: ig.ENTITY.Effect, full: boolean) {
    let data
    if (!this.sentEver || full) {
        data = {
            pos: this.coll.pos,
            effectName: this.effect!.effectName,
            sheetPath: this.effect!.sheet.path,
            target: undefinedIfFalsy(this.target?.netid),
            target2: undefinedIfFalsy(this.target2.entity?.netid),
            target2Point: undefinedIfFalsy(this.target2.point),
            target2Align: undefinedIfFalsy(this.target2.align),
            target2Offset: undefinedIfVec3Zero(this.target2.offset),
            noMultiGroup: undefinedIfFalsy(this.noMultiGroup),
            spriteFilter: undefinedIfFalsy(this.spriteFilter),
            offset: undefinedIfVec3Zero(this.offset),
            rotOffset: undefinedIfFalsy(this.rotOffset),
            align: undefinedIfFalsy(this.align),
            angle: undefinedIfFalsy(this.angle),
            flipX: undefinedIfFalsy(this.flipX),
            rotateFace: undefinedIfFalsy(this.rotateFace),
            flipLeftFace: undefinedIfFalsy(this.flipLeftFace),
            duration: this.duration == this.effect?.loopEndTime ? undefined : this.duration,
            group: undefinedIfFalsy(this.attachGroup),
        }
    } else {
        data = {
            pos: !this.target ? this.coll.pos : undefined,
        }
    }
    this.sentEver = true

    return data
}
function setState(this: ig.ENTITY.Effect, state: Return) {
    if (!this.target && state.pos) Vec3.assign(this.coll.pos, state.pos)

    this.update()
    this.deferredUpdate()
}

function resolveObjects(state: Return) {
    let target
    if (state.target) {
        target = ig.game.entitiesByNetid[state.target]
        if (!target) console.warn('target not found:', state.target)
    }
    let target2
    if (state.target2) {
        target2 = ig.game.entitiesByNetid[state.target2]
        if (!target2) console.warn('target2 not found:', state.target2)
    }
    assert(state.sheetPath)
    const sheet = new ig.EffectSheet(state.sheetPath)
    assert(sheet.effects)
    const effect = sheet.effects[state.effectName]

    return { target, target2, effect }
}

let particles: ig.EntityConstructor[]

prestart(() => {
    const typeId: EntityTypeId = 'ef'
    let effectId = 0
    ig.ENTITY.Effect.inject({
        getState,
        setState,
        createNetid() {
            if (!this.effect) return
            if (ig.ignoreEffectNetid) return undefined

            return `${typeId}${multi.server instanceof PhysicsServer ? 'P' : 'R'}${effectId++}`
        },
        init(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.setNetid(x, y, z, settings)
        },
        reset(x, y, z, settings) {
            this.effect = undefined
            this.parent(x, y, z, settings)
            this.setNetid(x, y, z, settings)
            this.sentEver = false
        },
    })

    const effectsSpawnedBefore = new TemporarySet<string>(400)
    ig.ENTITY.Effect.create = (netid: string, state: Return) => {
        if (effectsSpawnedBefore.has(netid)) return
        effectsSpawnedBefore.push(netid)

        const { target, target2, effect } = resolveObjects(state)
        const { x, y, z } = state.pos!
        const settings: ig.ENTITY.Effect.Settings = Object.assign({}, state, {
            effect,
            target,
            target2,
            netid,
        })
        assert(!ig.game.entitiesByNetid[netid])
        const entity = ig.game.spawnEntity(ig.ENTITY.Effect, x, y, z, settings)
        assert(ig.game.entitiesByNetid[netid])

        return entity
    }
    registerNetEntity({
        entityClass: ig.ENTITY.Effect,
        typeId,
        applyPriority: 2000,
        sendEmpty: true,
        ignoreDeath: true,
    })

    ig.ENTITY.Effect.forceRemotePhysics = true

    particles = [
        ig.ENTITY.Particle,
        // @ts-expect-error
        ig.ENTITY.FaceParticle,
        ig.ENTITY.CopyParticle,
        // @ts-expect-error
        ig.ENTITY.DebrisParticle,
        ig.ENTITY.OffsetParticle,
        ig.ENTITY.RhombusParticle,
        ig.ENTITY.HomingParticle,
        // @ts-expect-error
        ig.ENTITY.LaserParticle,
    ]
    for (const clazz of particles) {
        clazz.forceRemotePhysics = true
    }

    if (!REMOTE) return

    ig.ENTITY.Effect.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states?.[this.netid]) return

            this.parent()
        },
        deferredUpdate() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states?.[this.netid]) return

            this.parent()
        },
    })
}, 2)

declare global {
    interface StateUpdatePacket {
        clearEffects?: [string, string | undefined][]
    }
    namespace ig {
        var clearEffects: [string, string | undefined][] | undefined
    }
}
prestart(() => {
    addStateHandler({
        get(packet) {
            packet.clearEffects = ig.clearEffects
            ig.clearEffects = undefined
        },
        set(packet) {
            for (const player of ig.game.entities) {
                if (!(player instanceof dummy.DummyPlayer)) continue
                ig.EffectTools.clearEffects(player, 'modeAura')
            }

            if (!packet.clearEffects) return

            for (const [netid, withTheSameGroup] of packet.clearEffects) {
                const entity = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    // console.warn('entity', netid, 'not found, tried to effect clear')
                    continue
                }
                ig.EffectTools.clearEffects(entity, withTheSameGroup)
            }
        },
    })

    if (!PHYSICS) return
    const orig = ig.EffectTools.clearEffects
    ig.EffectTools.clearEffects = (entity, withTheSameGroup) => {
        orig(entity, withTheSameGroup)
        if (!entity.netid || !(multi.server instanceof PhysicsServer)) return
        if (withTheSameGroup == 'modeAura') return
        ig.clearEffects ??= []
        ig.clearEffects.push([entity.netid, withTheSameGroup])
    }
})

declare global {
    interface StateUpdatePacket {
        stopEffects?: string[]
    }
    namespace ig {
        var stopEffects: string[] | undefined
    }
}
prestart(() => {
    addStateHandler({
        get(packet) {
            packet.clearEffects
            packet.stopEffects = ig.stopEffects
            ig.stopEffects = undefined
        },
        set(packet) {
            if (!packet.stopEffects) return
            for (const netid of packet.stopEffects) {
                const entity = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    // console.warn('effect', netid, 'not found, tried to stop')
                    continue
                }
                assert(entity instanceof ig.ENTITY.Effect)
                entity.stop()
            }
        },
    })

    if (!PHYSICS) return
    ig.ENTITY.Effect.inject({
        stop() {
            this.parent()
            if (!(multi.server instanceof PhysicsServer)) return
            ig.stopEffects ??= []
            ig.stopEffects.push(this.netid)
        },
    })
})

declare global {
    namespace ig {
        interface Effect {
            sheet: ig.EffectSheet
            effectName: string
        }
    }
}
prestart(() => {
    ig.Effect.inject({
        init(sheet, effectName, data) {
            this.parent(sheet, effectName, data)
            this.sheet = sheet
            this.effectName = effectName
        },
    })
})

export function isParticleClass(clazz: ig.EntityConstructor): boolean {
    return particles.includes(clazz)
}

prestart(() => {
    if (!PHYSICS) return

    ig.EFFECT_ENTRY.COPY_SPRITE.inject({
        start(entity) {
            if (multi.server instanceof PhysicsServer && entity.target && !entity.target.netid) {
                console.warn(
                    `entity.target (${findClassName(entity.target)}) is not an net entity! on ig.EFFECT_ENTRY.COPY_SPRITE#start, clients will crash!`
                )
            }
            this.parent(entity)
        },
    })
})
