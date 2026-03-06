import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import type { u2 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace ig.ENTITY {
        interface BounceBlock extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.BounceBlock': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.BounceBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        blockState: memory.diff(this.blockState as u2),
    }
}

function setEntityState(this: ig.ENTITY.BounceBlock, state: Return) {
    if (state.blockState !== undefined) {
        this.blockState = state.blockState as 0 | 1 | 2
        if (ig.settingStateImmediately) {
            if (this.blockState) {
                this.onGroupResolve(true)
            } else {
                this.setCurrentAnim('off')
            }
        } else {
            if (this.blockState == 0) {
                this.setCurrentAnim('off')
            } else if (this.blockState == 1) {
                this.setCurrentAnim('on')
            } else if (this.blockState == 2) {
                this.onGroupResolve()
            }
        }
    }
}

prestart(() => {
    ig.ENTITY.BounceBlock.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.BounceBlock.create = () => {
        throw new Error('ig.ENTITY.BounceBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BounceBlock, isStatic: true })
    ig.ENTITY.BounceBlock.forceRemotePhysics = true
}, 2)
