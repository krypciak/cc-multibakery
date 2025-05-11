import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { PhysicsServer } from '../../server/physics-server'
import { RemoteServer } from '../../server/remote-server'
import { addStateHandler } from '../states'

export {}
declare global {
    namespace ig.ENTITY {
        interface Effect {
            type: 'ig.ENTITY.Effect'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface EffectConstructor {
            create(uuid: string, state: Return): ig.ENTITY.Effect | undefined
            priority: number
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Effect) {
    return {
        pos: this.coll.pos,
        effect: {
            effectName: this.effect!.effectName,
            sheetPath: this.effect!.sheet.path,
        },
        target: this.target?.uuid,
        target2: this.target2.entity?.uuid,
        target2Point: this.target2.point,
        target2Align: this.target2.align,
        target2Offset: this.target2.offset,
        noMultiGroup: this.noMultiGroup,
        spriteFilter: this.spriteFilter,
        offset: this.offset,
        rotOffset: this.rotOffset,
        align: this.align,
        angle: this.angle,
        flipX: this.flipX,
        rotateFace: this.rotateFace,
        flipLeftFace: this.flipLeftFace,
        duration: this.duration,
        group: this.attachGroup,
        // callback?: EventCallback,
    }
}
function setState(this: ig.ENTITY.Effect, state: Return) {
    if (!this.target) Vec3.assign(this.coll.pos, state.pos)
    // const { target, target2 } = resolveObjects(state)
    // this.target = target
    // this.target2.entity = target2
    // this.target2.point = state.target2Point
    // this.target2.align = state.target2Align
    // this.target2.offset = state.target2Offset
    // this.noMultiGroup = state.noMultiGroup
    // this.spriteFilter = state.spriteFilter
    // this.offset = state.offset
    // this.rotOffset = state.rotOffset
    // this.align = state.align
    // this.angle = state.angle
    // this.flipX = state.flipX
    // this.rotateFace = state.rotateFace
    // this.flipLeftFace = state.flipLeftFace
    // this.duration = state.duration
    // this.attachGroup = state.group

    // this.timer = state.timer

    this.update()
    this.deferredUpdate()
}

function resolveObjects(state: Return) {
    let target
    if (state.target) {
        target = ig.game.entitiesByUUID[state.target]
        if (!target) console.warn('target not found:', state.target)
    }
    let target2
    if (state.target2) {
        target2 = ig.game.entitiesByUUID[state.target2]
        if (!target2) console.warn('target2 not found:', state.target2)
    }
    let effect
    if (state.effect) {
        const sheet = new ig.EffectSheet(state.effect.sheetPath)
        assert(sheet.effects)
        effect = sheet.effects[state.effect.effectName]
    }

    return { target, target2, effect }
}

class TemporarySet<T> {
    private bins: Set<T>[] = [new Set<T>(), new Set<T>(), new Set<T>()]
    private currentBin = 0

    /* Guaranteed amount of items: [binSize, binSize*2] */
    /* Basically keep the last binSize items and remove the rest */
    constructor(private binSize: number) {}

    has(item: T) {
        return this.bins[0].has(item) || this.bins[1].has(item) || this.bins[2].has(item)
    }
    /* We are not worried about duplicates as they will not happen in this use case */
    push(item: T) {
        const currentBin = this.bins[this.currentBin]
        currentBin.add(item)
        if (currentBin.size >= this.binSize) {
            this.bins[(this.currentBin + 2) % this.bins.length].clear()
            this.currentBin = (this.currentBin + 1) % this.bins.length
        }
    }
}

prestart(() => {
    ig.ENTITY.Effect.inject({ getState, setState })

    const allEffectsUuidSpawned = new TemporarySet<string>(30)
    ig.ENTITY.Effect.create = (uuid: string, state: Return) => {
        if (allEffectsUuidSpawned.has(uuid)) return
        allEffectsUuidSpawned.push(uuid)

        const { target, target2, effect } = resolveObjects(state)
        const { x, y, z } = state.pos!
        const settings: ig.ENTITY.Effect.Settings = Object.assign({}, state, {
            effect,
            target,
            target2,
            uuid,
        })
        assert(!ig.game.entitiesByUUID[uuid])
        const entity = ig.game.spawnEntity(ig.ENTITY.Effect, x, y, z, settings)
        assert(ig.game.entitiesByUUID[uuid])
        return entity
    }
    ig.ENTITY.Effect.priority = 2000

    let effectId = 0
    ig.ENTITY.Effect.inject({
        init(x, y, z, settings) {
            settings.uuid ??= `Effect${effectId++}`
            this.parent(x, y, z, settings)
        },
        reset(x, y, z, settings) {
            settings.uuid ??= `Effect${effectId++}`
            this.parent(x, y, z, settings)
        },
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states?.[this.uuid]) return

            this.parent()
        },
        deferredUpdate() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states?.[this.uuid]) return

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
            if (!packet.clearEffects) return
            for (const [uuid, withTheSameGroup] of packet.clearEffects) {
                const entity = ig.game.entitiesByUUID[uuid]
                if (!entity) {
                    // console.warn('entity', uuid, 'not found, tried to effect clear')
                    continue
                }
                ig.EffectTools.clearEffects(entity, withTheSameGroup)
            }
        },
    })
    const orig = ig.EffectTools.clearEffects
    ig.EffectTools.clearEffects = (entity, withTheSameGroup) => {
        orig(entity, withTheSameGroup)
        if (!(multi.server instanceof PhysicsServer)) return
        ig.clearEffects ??= []
        ig.clearEffects.push([entity.uuid, withTheSameGroup])
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
            for (const uuid of packet.stopEffects) {
                const entity = ig.game.entitiesByUUID[uuid]
                if (!entity) {
                    // console.warn('effect', uuid, 'not found, tried to stop')
                    continue
                }
                assert(entity instanceof ig.ENTITY.Effect)
                entity.stop()
            }
        },
    })
    ig.ENTITY.Effect.inject({
        stop() {
            this.parent()
            if (!(multi.server instanceof PhysicsServer)) return
            ig.stopEffects ??= []
            ig.stopEffects.push(this.uuid)
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
