import { StateMemory, undefinedIfFalsy } from '../state-util'

type Return = ReturnType<typeof getState>
export function getState(this: sc.ActorEntity, memory: StateMemory) {
    return {
        pos: memory.diffVec3(this.coll.pos),
        currentAnim: memory.diff(this.currentAnim),
        currentAnimTimer: memory.onlyOnce(this.animState.timer),
        resetAnimTimer: undefinedIfFalsy(this.animState.timer - ig.system.tick == 0),

        face: memory.diffVec2(this.face),
        accelDir: memory.diffVec2(this.coll.accelDir),
        animAlpha: memory.diff(this.animState.alpha),
    }
}

export function setState(this: sc.ActorEntity, state: Return) {
    if (state.pos) {
        Vec3.assign(this.coll.pos, state.pos)
    }

    if (state.currentAnim !== undefined) {
        this.currentAnim = state.currentAnim
    }

    if (state.face) this.face = state.face
    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (state.resetAnimTimer) this.animState.timer = 0
    this.updateAnim()
    if (state.currentAnimTimer !== undefined) this.animState.timer = state.currentAnimTimer
}
