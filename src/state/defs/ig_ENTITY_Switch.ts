import { EntityTypeId, registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote/remote-server'
import { createNetidStaticEntity, isSameAsLast } from './entity'

declare global {
    namespace ig.ENTITY {
        interface Switch {
            getState(this: this, full: boolean): Return
            setState(this: this, state: Return): void

            lastSent?: Return
        }
        interface SwitchConstructor {
            create(netid: string, state: Return): ig.ENTITY.Switch
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Switch, full: boolean) {
    return {
        isOn: isSameAsLast(this, full, this.isOn, 'isOn'),
    }
}
function setState(this: ig.ENTITY.Switch, state: Return) {
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
    const typeId: EntityTypeId = 'sw'
    ig.ENTITY.Switch.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Switch.create = () => {
        throw new Error('ig.ENTITY.Switch.create not implemented')
    }
    registerNetEntity(ig.ENTITY.Switch, typeId)

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
