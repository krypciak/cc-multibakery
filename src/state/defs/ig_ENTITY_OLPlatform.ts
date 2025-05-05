import { prestart } from '../../plugin'

export {}
declare global {
    namespace ig.ENTITY {
        interface OLPlatform {
            type: 'ig.ENTITY.OLPlatform'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface OLPlatformConstructor {
            create(uuid: string, state: Return): ig.ENTITY.OLPlatform
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: ig.ENTITY.OLPlatform) {
    return {
        currentState: this.states.indexOf(this.currentState),
    }
}
function setState(this: ig.ENTITY.OLPlatform, state: Return) {
    const currentStateIndex = state.currentState ?? -1
    const platformState = this.states[currentStateIndex]

    const immediately = false
    if (platformState && platformState != this.currentState) {
        Vec3.assign(this._lastPos, this.coll.pos)
        if (immediately) {
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

prestart(() => {
    ig.ENTITY.OLPlatform.inject({ getState, setState })
    ig.ENTITY.OLPlatform.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.OLPlatform.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.OLPlatform, ig.ENTITY.OLPlatform.Settings>(
        //     ig.ENTITY.OLPlatform,
        //     0,
        //     0,
        //     0,
        //     {
        //         uuid,
        //     }
        // )
        // return entity
    }
}, 2)
