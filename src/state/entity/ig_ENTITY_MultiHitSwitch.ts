import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../states'
import type { u4 } from 'ts-binarifier/src/type-aliases'
import { isRemote } from '../../server/remote/is-remote-server'

declare global {
    namespace ig.ENTITY {
        interface MultiHitSwitch extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.MultiHitSwitch': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.MultiHitSwitch, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        currentHits: memory.diff(this.currentHits as u4),
    }
}
function setState(this: ig.ENTITY.MultiHitSwitch, state: Return) {
    const hits = state.currentHits
    if (hits !== undefined && this.currentHits != hits) {
        const oldHits = this.currentHits
        this.currentHits = hits

        if (hits >= this.hitsToActive) {
            if (ig.settingStateImmediately) {
                this.animationEnded('switch')
            } else {
                this.setCurrentAnim('switch', true, null, true, true)
                ig.SoundHelper.playAtEntity(this.activateSound, this)
            }
        } else {
            this._setAnimation()
            if (hits > oldHits && !ig.settingStateImmediately) ig.SoundHelper.playAtEntity(this.countSound, this)
        }
    }
}

prestart(() => {
    ig.ENTITY.MultiHitSwitch.inject({
        getState,
        setState,
    })
    ig.ENTITY.MultiHitSwitch.create = () => {
        throw new Error('ig.ENTITY.MultiHitSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.MultiHitSwitch, isStatic: true })

    if (!REMOTE) return

    ig.ENTITY.MultiHitSwitch.inject({
        update() {
            if (!isRemote(multi.server)) return this.parent()

            /* skip this.currentHits decreasing */
            ig.AnimatedEntity.prototype.update.call(this)
        },
        ballHit(ball) {
            if (!isRemote(multi.server)) return this.parent(ball)
            return false
        },
    })
}, 2)
