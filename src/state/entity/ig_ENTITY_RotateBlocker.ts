import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { isRemote } from '../../server/remote/remote-server-types'

declare global {
    namespace ig.ENTITY {
        interface RotateBlocker extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.RotateBlocker': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.RotateBlocker, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        active: memory.diff(this.active),
        currentDir: memory.diff(this.currentDir),
        currentAngle: memory.diff(this.currentAngle),
        destAngle: memory.diff(this.destAngle),
        turnTimer: memory.diff(this.turnTimer),
    }
}

function setEntityState(this: ig.ENTITY.RotateBlocker, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.active !== undefined) this.active = state.active
    if (state.currentDir !== undefined) this.currentDir = state.currentDir
    if (state.currentAngle !== undefined) this.currentAngle = state.currentAngle
    if (state.destAngle !== undefined) this.destAngle = state.destAngle
    if (state.turnTimer !== undefined) this.turnTimer = state.turnTimer
}

prestart(() => {
    ig.ENTITY.RotateBlocker.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.RotateBlocker.create = () => {
        throw new Error('ig.ENTITY.RotateBlocker.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.RotateBlocker })

    if (REMOTE) {
        ig.ENTITY.RotateBlocker.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
                ig.AnimatedEntity.prototype.update.call(this)
            },
            turn(dir) {
                if (!isRemote(multi.server)) return this.parent(dir)
            },
        })
    }
}, 2)
