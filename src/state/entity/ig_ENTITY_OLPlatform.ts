import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import { type StateKey } from '../states'
import { type i5 } from 'ts-binarifier/src/type-aliases'

declare global {
    namespace ig.ENTITY {
        interface OLPlatform extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.OLPlatform': Return
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.OLPlatform, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        currentState: memory.diff(this.states.indexOf(this.currentState) as i5),
    }
}
function setState(this: ig.ENTITY.OLPlatform, state: Return) {
    if (state.currentState !== undefined) {
        const platformState = this.states[state.currentState]

        if (platformState && platformState != this.currentState) {
            Vec3.assign(this._lastPos, this.coll.pos)
            if (ig.settingStateImmediately) {
                Vec3.assign(this.coll.pos, platformState.pos)
            } else {
                const sound = this.sound.move.play() as ig.SoundHandleWebAudio
                const pos = this.getAlignedPos(ig.ENTITY_ALIGN.CENTER)
                this.usePositionalSound && sound.setFixPosition(pos, 800)

                let dist = Vec3.distance(this._lastPos, platformState.pos)
                this.staticSpeed && (dist = 32)
                dist /= this.speed
                this.timer.set(dist, ig.TIMER_MODE.ONCE)
                this.quickNavUpdate = dist > 1
            }
            if (this.currentState && this.currentState.maps != platformState.maps) this.spritesInitialized = false
        }
        this.currentState = platformState
    }
}

prestart(() => {
    ig.ENTITY.OLPlatform.inject({
        getState,
        setState,
    })
    ig.ENTITY.OLPlatform.create = () => {
        throw new Error('ig.ENTITY.OLPlatform.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.OLPlatform, isStatic: true })
}, 2)
