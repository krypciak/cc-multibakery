import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface Door extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Door': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.Door, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const opened = this.lastOpened?.frame == ig.system.frame - 1
    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        opened: opened ? true : undefined,
        openGlobalSound: memory.diff(this.lastOpened?.globalSound),
    }
}

function setEntityState(this: ig.ENTITY.Door, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.opened === true) {
        if (this.openSound) {
            if (state.openGlobalSound) this.openSound.play()
            else ig.SoundHelper.playAtEntity(this.openSound, this)
        }
    }
}

prestart(() => {
    ig.ENTITY.Door.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.Door.create = () => {
        throw new Error('ig.ENTITY.Door.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Door })
}, 2)

declare global {
    namespace ig.ENTITY {
        interface Door {
            lastOpened?: { frame: number; globalSound?: boolean }
        }
    }
}
prestart(() => {
    ig.ENTITY.Door.inject({
        open(globalSound, openTimer) {
            this.parent(globalSound, openTimer)
            this.lastOpened = { frame: ig.system.frame, globalSound }
        },
    })
})
