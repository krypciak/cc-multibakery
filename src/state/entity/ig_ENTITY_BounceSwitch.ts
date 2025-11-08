import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface BounceSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.BounceSwitch': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.BounceSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)
    return {
        isOn: memory.diff(this.isOn),
    }
}

function setState(this: ig.ENTITY.BounceSwitch, state: Return) {
    if (state.isOn !== undefined) {
        this.isOn = state.isOn
        if (ig.settingStateImmediately) {
            this.setCurrentAnim(this.isOn ? 'on' : 'off')
        } else {
            if (this.isOn) {
                this.setCurrentAnim('rolling')
                this.timer = 0.5
            }
        }
    }
}

prestart(() => {
    ig.ENTITY.BounceSwitch.inject({
        getState,
        setState,
    })
    ig.ENTITY.BounceSwitch.create = () => {
        throw new Error('ig.ENTITY.BounceSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.BounceSwitch, netidStatic: true })
    ig.ENTITY.BounceSwitch.forceRemotePhysics = true

    if (!REMOTE) return

    ig.ENTITY.BounceSwitch.inject({
        animationEnded(animation) {
            ig.ignoreEffectNetid = true
            this.parent(animation)
            ig.ignoreEffectNetid = false
        },
    })
}, 2)
