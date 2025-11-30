import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface DynamicPlatform extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.DynamicPlatform': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.DynamicPlatform, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.diffVec3(this.coll.pos),
    }
}
function setState(this: ig.ENTITY.DynamicPlatform, state: Return) {
    this.update()

    if (state.pos) {
        Vec3.assign(this.coll.pos, state.pos)
        this.coll.baseZPos = this.coll.pos.z
    }
}

prestart(() => {
    ig.ENTITY.DynamicPlatform.inject({
        getState,
        setState,
    })
    ig.ENTITY.DynamicPlatform.create = () => {
        throw new Error('ig.ENTITY.DynamicPlatform.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.DynamicPlatform, isStatic: true })

    if (REMOTE) {
        ig.ENTITY.DynamicPlatform.inject({
            update() {
                if (!isRemote(multi.server)) return this.parent()
                if (!ig.settingState) return

                this.parent()
            },
        })
    }
}, 2)
