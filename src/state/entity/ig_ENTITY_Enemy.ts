import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createNetidStatic } from '../entity'
import { StateMemory, undefinedIfFalsy } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface Enemy extends StateMemory.MapHolder<StateKey> {}
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Enemy, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

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

function setState(this: ig.ENTITY.Enemy, state: Return) {
    if (state.pos) Vec3.assign(this.coll.pos, state.pos)

    if (state.currentAnim !== undefined && this.currentAnim != state.currentAnim) {
        this.currentAnim = state.currentAnim
    }

    if (state.face) this.face = state.face
    if (state.accelDir) this.coll.accelDir = state.accelDir
    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (this.enemyType && !this.enemyTypeInitialized) this.enemyType.initEntity(this)

    if (state.resetAnimTimer) this.animState.timer = 0
    this.updateAnim()
    if (state.currentAnimTimer !== undefined) this.animState.timer = state.currentAnimTimer
}

prestart(() => {
    const typeId: EntityTypeId = 'en'
    ig.ENTITY.Enemy.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Enemy.create = () => {
        throw new Error('ig.ENTITY.Enemy.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Enemy, typeId, netidStatic: true })

    if (!REMOTE) return

    ig.ENTITY.Enemy.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
