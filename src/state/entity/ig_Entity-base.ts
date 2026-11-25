import { prestart } from '../../loading-stages'
import type { StateMemory } from '../state-util'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.Entity, memory: StateMemory) {
    return {
        pos: memory.diffVec3(this.coll.pos),
        baseZPos: memory.diff(this.coll.baseZPos),
        size: memory.diffVec3(this.coll.size),
        hidden: memory.diff(this._hidden),

        accelDir: memory.diffVec2(this.coll.accelDir),
        relativeVel: memory.diff(this.coll.relativeVel),
    }
}

export function setEntityState(this: ig.Entity, state: Return) {
    if (state.pos) {
        this.setPos(state.pos.x, state.pos.y, state.pos.z)
    }
    if (state.baseZPos !== undefined) this.coll.baseZPos = state.baseZPos

    if (state.size !== undefined) this.setSize(state.size.x, state.size.y, state.size.z)

    if (state.hidden !== undefined && this._hidden !== state.hidden) {
        if (state.hidden) {
            this.hide()
        } else {
            this.show(ig.shared.settingStateImmediately)
        }
    }

    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.relativeVel !== undefined) this.coll.relativeVel = state.relativeVel
}

prestart(() => {
    ig.Entity.inject({
        show(noShowFx) {
            if (!multi.server || !this._killed) return this.parent(noShowFx)
        },
    })

    /* inject into Enemy seperately because ig.Entity inject gets skipped */
    ig.ENTITY.Enemy.inject({
        show(noShowFx) {
            if (!multi.server || !this._killed) return this.parent(noShowFx)
        },
    })
}, 0)
