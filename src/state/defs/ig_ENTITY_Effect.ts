import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote-server'

export {}
declare global {
    namespace ig.ENTITY {
        interface Effect {
            type: 'ig.ENTITY.Effect'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface EffectConstructor {
            create(uuid: string, state: Return): ig.ENTITY.Effect
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
    // console.log(this.duration, this.timer)

    this.update()
    this.deferredUpdate()
}

function resolveObjects(state: Return) {
    let target
    if (state.target) {
        target = ig.game.entitiesByUUID[state.target]
        // assert(target)
    }
    let target2
    if (state.target2) {
        target2 = ig.game.entitiesByUUID[state.target2]
        // assert(target2)
    }
    let effect
    if (state.effect) {
        const sheet = new ig.EffectSheet(state.effect.sheetPath)
        assert(sheet.effects)
        effect = sheet.effects[state.effect.effectName]
    }

    return { target, target2, effect }
}

prestart(() => {
    ig.ENTITY.Effect.inject({ getState, setState })
    ig.ENTITY.Effect.create = (uuid: string, state: Return) => {
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

    ig.ENTITY.Effect.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states[this.uuid]) return

            this.parent()
        },
        deferredUpdate() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState && ig.lastStatePacket?.states[this.uuid]) return
            if (!ig.settingState && !ig.lastStatePacket?.states[this.uuid]) {
                console.log('def update when no info')
            }

            this.parent()
        },
    })
}, 2)

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
