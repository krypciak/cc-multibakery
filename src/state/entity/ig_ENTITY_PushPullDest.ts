import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import type { i24 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace ig.ENTITY {
        interface PushPullDest extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.PushPullDest': Return
    }
}

function getPullable(dest: ig.ENTITY.PushPullDest) {
    return ig.game.getEntityByMapId(dest.placedData?.id ?? -1) as sc.PullableEntity | undefined
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.PushPullDest, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const pullable = getPullable(this)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        placedId: memory.diff((this.placedData?.id ?? -1) as i24),
        interactableActive: memory.diff(pullable?.pushPullable.active),
    }
}
function setEntityState(this: ig.ENTITY.PushPullDest, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.placedId !== undefined) {
        if (state.placedId == -1) this.placedData = null
        else this.placedData = { id: state.placedId }
    }

    if (state.interactableActive !== undefined) {
        const pullable = getPullable(this)
        pullable?.pushPullable.setActive(state.interactableActive)
    }
}

prestart(() => {
    ig.ENTITY.PushPullDest.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.PushPullDest.create = () => {
        throw new Error('ig.ENTITY.PushPullDest.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.PushPullDest })
}, 2)
