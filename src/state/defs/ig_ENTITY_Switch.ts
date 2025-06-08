import { EntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { createUuidStaticEntity } from './entity'

declare global {
    namespace ig.ENTITY {
        interface Switch {
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface SwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.Switch
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.Switch) {
    return {
        isOn: this.isOn ? true : undefined,
    }
}
function setState(this: ig.ENTITY.Switch, state: Return) {
    const isOn = !!state.isOn
    if (this.isOn != isOn) {
        this.isOn = isOn
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
        createUuid(x, y, z, settings) {
            return createUuidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.Switch.create = () => {
        throw new Error('ig.ENTITY.Switch.create not implemented')
    }
    ig.registerEntityTypeId(ig.ENTITY.Switch, typeId)
}, 2)
