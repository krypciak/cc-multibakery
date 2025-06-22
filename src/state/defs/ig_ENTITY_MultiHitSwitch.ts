import { EntityTypeId, registerEntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createUuidStaticEntity, isSameAsLast } from './entity'

declare global {
    namespace ig.ENTITY {
        interface MultiHitSwitch {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void

            lastSent?: Return
        }
        interface MultiHitSwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.MultiHitSwitch
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.MultiHitSwitch, full: boolean) {
    return {
        currentHits: isSameAsLast(this, full, this.currentHits, 'currentHits'),
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
    const typeId: EntityTypeId = 'mh'
    ig.ENTITY.MultiHitSwitch.inject({
        getState,
        setState,
        createUuid(x, y, z, settings) {
            return createUuidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.MultiHitSwitch.create = () => {
        throw new Error('ig.ENTITY.MultiHitSwitch.create not implemented')
    }
    registerEntityTypeId(ig.ENTITY.MultiHitSwitch, typeId)

    ig.ENTITY.MultiHitSwitch.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()

            /* skip this.currentHits decreasing */
            ig.AnimatedEntity.prototype.update.call(this)
        },
        ballHit(ball) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(ball)
            return false
        },
    })
}, 2)
