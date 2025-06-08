import { EntityTypeId } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { createUuidStaticEntity } from './entity'

declare global {
    namespace ig.ENTITY {
        interface OneTimeSwitch {
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface OneTimeSwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.OneTimeSwitch
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.OneTimeSwitch) {
    return {
        isOn: this.isOn ? true : undefined,
    }
}
function setState(this: ig.ENTITY.OneTimeSwitch, state: Return) {
    const isOn = !!state.isOn
    if (this.isOn != isOn) {
        this.isOn = isOn
        if (isOn) {
            if (ig.settingStateImmediately) {
                this.finalizeOn()
            } else {
                this.setOn()
                ig.SoundHelper.playAtEntity(this.sounds.hit, this)
                ig.SoundHelper.playAtEntity(this.sounds.bing, this)
            }
        } else this.setOff()
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'ot'
    ig.ENTITY.OneTimeSwitch.inject({
        getState,
        setState,
        createUuid(x, y, z, settings) {
            return createUuidStaticEntity(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.OneTimeSwitch.create = () => {
        throw new Error('ig.ENTITY.OneTimeSwitch.create not implemented')
    }
    ig.registerEntityTypeId(ig.ENTITY.OneTimeSwitch, typeId)
}, 2)
