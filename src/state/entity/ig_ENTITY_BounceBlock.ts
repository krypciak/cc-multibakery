import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface BounceBlock extends StateMemory.MapHolder<StateKey> {}
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.BounceBlock, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        blockState: memory.diff(this.blockState),
    }
}

function setState(this: ig.ENTITY.BounceBlock, state: Return) {
    if (state.blockState !== undefined) {
        this.blockState = state.blockState
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
    const typeId: EntityTypeId = 'bb'
    ig.ENTITY.BounceBlock.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.BounceBlock.create = () => {
        throw new Error('ig.ENTITY.BounceBlock.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BounceBlock, typeId, netidStatic: true })
    ig.ENTITY.BounceBlock.forceRemotePhysics = true
}, 2)
