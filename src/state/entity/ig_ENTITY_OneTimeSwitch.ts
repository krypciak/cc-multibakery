import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import { isRemote } from '../../server/remote/remote-server-types'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'

declare global {
    namespace ig.ENTITY {
        interface OneTimeSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.OneTimeSwitch': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.OneTimeSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        isOn: memory.diff(this.isOn),
    }
}
function setEntityState(this: ig.ENTITY.OneTimeSwitch, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.isOn !== undefined && this.isOn != state.isOn) {
        this.isOn = state.isOn
        if (state.isOn && !ig.shared.settingStateImmediately) {
            ig.SoundHelper.playAtEntity(this.sounds.hit, this)
            ig.SoundHelper.playAtEntity(this.sounds.bing, this)
        }
    }
}

prestart(() => {
    ig.ENTITY.OneTimeSwitch.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.OneTimeSwitch.create = () => {
        throw new Error('ig.ENTITY.OneTimeSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.OneTimeSwitch })

    if (!REMOTE) return

    ig.ENTITY.OneTimeSwitch.inject({
        ballHit(ball) {
            if (!isRemote(multi.server)) return this.parent(ball)
            return false
        },
        varsChanged() {
            if (!isRemote(multi.server)) return this.parent()
        },
    })
}, 2)
