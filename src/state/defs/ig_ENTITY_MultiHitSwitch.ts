import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'

export {}
declare global {
    namespace ig.ENTITY {
        interface MultiHitSwitch {
            type: 'ig.ENTITY.MultiHitSwitch'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface MultiHitSwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.MultiHitSwitch
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: ig.ENTITY.MultiHitSwitch) {
    return {
        currentHits: this.currentHits > 0 ? this.currentHits : undefined,
    }
}
function setState(this: ig.ENTITY.MultiHitSwitch, state: Return) {
    const hits = state.currentHits ?? 0
    if (this.currentHits != hits) {
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
    ig.ENTITY.MultiHitSwitch.inject({ getState, setState })
    ig.ENTITY.MultiHitSwitch.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.MultiHitSwitch.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.MultiHitSwitch, ig.ENTITY.MultiHitSwitch.Settings>(
        //     ig.ENTITY.MultiHitSwitch,
        //     0,
        //     0,
        //     0,
        //     {
        //         uuid,
        //     }
        // )
        // return entity
    }

    ig.ENTITY.MultiHitSwitch.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()

            /* skip this.currentHits decreasing */
            ig.AnimatedEntity.prototype.update.call(this)
        },
    })
}, 2)
