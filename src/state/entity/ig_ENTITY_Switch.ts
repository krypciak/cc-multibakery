import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { RemoteServer } from '../../server/remote/remote-server'
import { StateMemory } from '../state-util'
import { type StateKey } from '../states'

declare global {
    namespace ig.ENTITY {
        interface Switch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.Switch': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Switch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        pos: memory.diffVec3(this.coll.pos),
        isOn: memory.diff(this.isOn),
    }
}
function setState(this: ig.ENTITY.Switch, state: Return) {
    if (state.pos) {
        Vec3.assign(this.coll.pos, state.pos)
        this.coll.baseZPos = this.coll.pos.z
    }

    if (state.isOn !== undefined && this.isOn != state.isOn) {
        this.isOn = state.isOn
        const anim = this.isOn ? 'switchOn' : 'switchOff'
        const followUpAnim = this.isOn ? 'on' : 'off'

        if (ig.settingStateImmediately) {
            this.setCurrentAnim(followUpAnim, true, null, true)
        } else {
            this.setCurrentAnim(anim, true, followUpAnim, true)
            ig.SoundHelper.playAtEntity(this.sounds.hit, this)
            ig.SoundHelper.playAtEntity(this.sounds.bing, this)
        }
    }
}

prestart(() => {
    ig.ENTITY.Switch.inject({
        getState,
        setState,
    })
    ig.ENTITY.Switch.create = () => {
        throw new Error('ig.ENTITY.Switch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.Switch, isStatic: true })

    if (!REMOTE) return

    ig.ENTITY.Switch.inject({
        ballHit(ball) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(ball)
            return false
        },
        varsChanged() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
