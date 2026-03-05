import type { StateMemory } from '../state-util'
import { undefinedIfFalsy } from '../state-util'

type Return = ReturnType<typeof getState>
export function getState(this: ig.AnimatedEntity, memory: StateMemory) {
    return {
        pos: memory.diffVec3(this.coll.pos),
        baseZPos: memory.diff(this.coll.baseZPos),
        hidden: memory.diff(this._hidden),
        currentAnim: memory.diff(typeof this.currentAnim === 'string' ? this.currentAnim : undefined),
        currentAnimTimer: memory.onlyOnce(this.animState.timer),
        resetAnimTimer: undefinedIfFalsy(this.animState.timer - ig.system.tick == 0),

        accelDir: memory.diffVec2(this.coll.accelDir),
        animAlpha: memory.diff(this.animState.alpha),
    }
}

export function setState(this: ig.AnimatedEntity, state: Return) {
    if (state.pos) {
        this.setPos(state.pos.x, state.pos.y, state.pos.z)
    }
    if (state.baseZPos !== undefined) this.coll.baseZPos = state.baseZPos

    if (state.currentAnim !== undefined) {
        this.currentAnim = state.currentAnim
    }

    if (state.hidden !== undefined && this._hidden !== state.hidden) {
        if (state.hidden) {
            this.hide()
        } else {
            this.show()
        }
    }

    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (state.resetAnimTimer) this.animState.timer = 0
    this.updateAnim()
    if (state.currentAnimTimer !== undefined) this.animState.timer = state.currentAnimTimer
}
