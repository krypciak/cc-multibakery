import { assert } from '../../misc/assert'
import { type EntityNetid, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData, StateMemory, undefinedIfFalsy, undefinedIfVec3Zero } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import type { f64, i6, u16 } from 'ts-binarifier/src/type-aliases'
import { isPhysics } from '../../server/physics/physics-server-types'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'

declare global {
    namespace ig.ENTITY {
        interface Effect extends StateMemory.MapHolder<StateKey> {}
    }

    interface EntityStates {
        'ig.ENTITY.Effect': Return
    }
}

type Return = Exclude<ReturnType<typeof getEntityState>, undefined>
function getEntityState(this: ig.ENTITY.Effect, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.diff(!this.target || memory.isFirstTime() ? this.coll.pos : undefined),

        effectName: memory.onlyOnce(this.effect!.effectName),
        sheetPath: memory.onlyOnce(this.effect!.sheet.path),
        target: memory.onlyOnce(undefinedIfFalsy(this.target?.netid)),
        target2: memory.onlyOnce(undefinedIfFalsy(this.target2.entity?.netid)),
        target2Point: memory.onlyOnce(undefinedIfFalsy(this.target2.point)),
        target2Align: memory.onlyOnce(undefinedIfFalsy(this.target2.align)),
        target2Offset: memory.onlyOnce(undefinedIfVec3Zero(this.target2.offset)),
        noMultiGroup: memory.onlyOnce(undefinedIfFalsy(this.noMultiGroup)),
        spriteFilter: memory.onlyOnce(undefinedIfFalsy(this.spriteFilter as u16[])),
        offset: memory.onlyOnce(undefinedIfVec3Zero(this.offset)),
        rotOffset: memory.onlyOnce(undefinedIfFalsy(this.rotOffset)),
        align: memory.onlyOnce(undefinedIfFalsy(this.align)),
        angle: memory.onlyOnce(undefinedIfFalsy(this.angle as f64)),
        flipX: memory.onlyOnce(undefinedIfFalsy(this.flipX)),
        rotateFace: memory.diff(undefinedIfFalsy(this.rotateFace as i6)),
        flipLeftFace: memory.onlyOnce(undefinedIfFalsy(this.flipLeftFace)),
        duration: memory.onlyOnce(this.duration == this.effect?.loopEndTime ? undefined : this.duration),
        group: memory.onlyOnce(undefinedIfFalsy(this.attachGroup)),
    }
}
function setEntityState(this: ig.ENTITY.Effect, state: Return) {
    if (!this.target && state.pos) this.setPos(state.pos.x, state.pos.y, state.pos.z)

    if (state.rotateFace !== undefined) {
        this.rotateFace = state.rotateFace
    }
}

const targetNotFoundIgnoreEffectNames = new Set(['ballTrailCold'])
function resolveObjects(state: Return) {
    let target
    if (state.target) {
        target = ig.game.entitiesByNetid[state.target]
        if (!target && !targetNotFoundIgnoreEffectNames.has(state.effectName ?? ''))
            console.warn('resolveObjects target not found:', state.target)
    }
    let target2
    if (state.target2) {
        target2 = ig.game.entitiesByNetid[state.target2]
        if (!target2) console.warn('resolveObjects target2 not found:', state.target2)
    }
    assert(state.sheetPath)
    const sheet = new ig.EffectSheet(state.sheetPath)
    assert(sheet.effects)
    const effect = sheet.effects[state.effectName!]
    if (sheet.loaded) assert(effect)

    return { target, target2, effect, sheetLoaded: sheet.loaded }
}

let particles: ig.EntityConstructor[]

prestart(() => {
    ig.ENTITY.Effect.inject({
        getEntityState,
        setEntityState,
        reset(x, y, z, settings) {
            this.effect = undefined
            this.parent(x, y, z, settings)
            this.lastSent = new WeakMap()
        },
    })

    ig.ENTITY.Effect.create = (netid: EntityNetid, state: Return) => {
        if (!state.sheetPath) return

        const { target, target2, effect, sheetLoaded } = resolveObjects(state)
        if (!sheetLoaded) return

        const { x, y, z } = state.pos ?? { x: 0, y: 0, z: 0 }
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
        applyPriority: 2000,
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
}, 2)

declare global {
    interface MapStateOrderedEvents {
        stopEffect: {
            type: 'stopEffect'
            netid: EntityNetid
        }
    }
}
registerOrderedEvent('stopEffect', {
    set({ netid }) {
        const entity = ig.game.entitiesByNetid[netid]
        if (!entity) {
            // console.warn('effect', netid, 'not found, tried to stop')
            return
        }
        assert(entity instanceof ig.ENTITY.Effect)
        entity.stop()
    },
})

prestart(() => {
    if (!PHYSICSNET) return
    ig.ENTITY.Effect.inject({
        stop() {
            this.parent()
            if (!shouldCollectStateData() || !this.netid) return
            pushOrderedEvent({ type: 'stopEffect', netid: this.netid })
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

prestart(() => {
    if (!PHYSICSNET) return

    if (ASSERT) {
        ig.EFFECT_ENTRY.COPY_SPRITE.inject({
            start(entity) {
                if (isPhysics(multi.server) && entity.target && !entity.target.netid) {
                    console.warn(
                        `entity.target (${findClassName(entity.target)}) is not an net entity! on ig.EFFECT_ENTRY.COPY_SPRITE#start, clients will crash!`
                    )
                }
                this.parent(entity)
            },
        })
    }
})
