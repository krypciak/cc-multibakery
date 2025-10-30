import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { createNetidStatic } from '../entity'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'
import { RemoteServer } from '../../server/remote/remote-server'

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
    const typeId: EntityTypeId = 'dp'
    ig.ENTITY.DynamicPlatform.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.DynamicPlatform.create = () => {
        throw new Error('ig.ENTITY.DynamicPlatform.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.DynamicPlatform, typeId, netidStatic: true })

    if (REMOTE) {
        ig.ENTITY.DynamicPlatform.inject({
            update() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()
                if (!ig.settingState) return

                this.parent()
            },
        })
    }
}, 2)
