import { assert } from '../../misc/assert'
import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../plugin'
import { PhysicsServer } from '../../server/physics/physics-server'
import { RemoteServer } from '../../server/remote/remote-server'
import { addStateHandler } from '../states'
import { undefinedIfFalsy, undefinedIfVec3Zero } from './entity'

declare global {
    namespace ig.ENTITY {
        interface Effect {
            getState(this: this, full: boolean): Return | undefined
            setState(this: this, state: Return): void

            sentEver?: boolean
        }
        interface EffectConstructor {
            create(netid: string, state: Return): ig.ENTITY.Effect | undefined
        }
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

export class TemporarySet<T> {
    private bins: Set<T>[] = [new Set<T>(), new Set<T>()]
    private currentBin = 0

    /* Guaranteed amount of items: [binSize, binSize*2] */
    /* Basically keep the last binSize items and remove the rest */
    constructor(private binSize: number) {}

    has(item: T) {
        return this.bins[0].has(item) || this.bins[1].has(item)
    }
    /* We are not worried about duplicates as they will not happen in this use case */
    push(item: T) {
        const currentBin = this.bins[this.currentBin]
        currentBin.add(item)
        if (currentBin.size >= this.binSize) {
            this.bins[(this.currentBin + 1) % this.bins.length].clear()
            this.currentBin = (this.currentBin + 1) % this.bins.length
        }
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'ef'
    let effectId = 0
    ig.ENTITY.Effect.inject({
        getState,
        setState,
        createNetid() {
            return `${typeId}${multi.server instanceof PhysicsServer ? 'P' : 'R'}${effectId++}`
        },
        reset(x, y, z, settings) {
            this.parent(x, y, z, settings)
            this.sentEver = false
        },
    })

    const allEffectsNetidSpawned = new TemporarySet<string>(50)
    ig.ENTITY.Effect.create = (netid: string, state: Return) => {
        if (allEffectsNetidSpawned.has(netid)) return
        allEffectsNetidSpawned.push(netid)

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
    registerNetEntity({ entityClass: ig.ENTITY.Effect, typeId, applyPriority: 2000, sendEmpty: true })

    ig.ENTITY.Effect.forceRemotePhysics = true
    ig.ENTITY.Particle.forceRemotePhysics = true
    ig.ENTITY.CopyParticle.forceRemotePhysics = true

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
    const orig = ig.EffectTools.clearEffects
    ig.EffectTools.clearEffects = (entity, withTheSameGroup) => {
        orig(entity, withTheSameGroup)
        if (!(multi.server instanceof PhysicsServer)) return
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
    ig.ENTITY.Effect.inject({
        stop() {
            this.parent()
            if (!(multi.server instanceof PhysicsServer)) return
            ig.stopEffects ??= []
            ig.stopEffects.push(this.netid)
            console.log('stopping', this.netid, this.effect?.effectName)
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
