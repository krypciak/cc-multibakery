import { StateMemory, undefinedIfFalsy } from '../state-util'

type Return = ReturnType<typeof getState>
export function getState(this: ig.AnimatedEntity, memory: StateMemory) {
    return {
        pos: memory.diffVec3(this.coll.pos),
        currentAnim: memory.diff(this.currentAnim),
        currentAnimTimer: memory.onlyOnce(this.animState.timer),
        resetAnimTimer: undefinedIfFalsy(this.animState.timer - ig.system.tick == 0),

        accelDir: memory.diffVec2(this.coll.accelDir),
        animAlpha: memory.diff(this.animState.alpha),
    }
}

export function setState(this: ig.AnimatedEntity, state: Return) {
    if (state.pos) {
        Vec3.assign(this.coll.pos, state.pos)
    }

    if (state.currentAnim !== undefined) {
        this.currentAnim = state.currentAnim
    }

    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (state.resetAnimTimer) this.animState.timer = 0
    this.updateAnim()
    if (state.currentAnimTimer !== undefined) this.animState.timer = state.currentAnimTimer
}
