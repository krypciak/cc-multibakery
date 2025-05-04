import { prestart } from '../../plugin'

export {}
declare global {
    namespace ig.ENTITY {
        interface OneTimeSwitch {
            type: 'ig.ENTITY.OneTimeSwitch'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface OneTimeSwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.OneTimeSwitch
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
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
            this.setOn()
            ig.SoundHelper.playAtEntity(this.sounds.hit, this)
            ig.SoundHelper.playAtEntity(this.sounds.bing, this)
        } else this.setOff()
    }
}

prestart(() => {
    ig.ENTITY.OneTimeSwitch.inject({ getState, setState })
    ig.ENTITY.OneTimeSwitch.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.OneTimeSwitch.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.OneTimeSwitch, ig.ENTITY.OneTimeSwitch.Settings>(
        //     ig.ENTITY.OneTimeSwitch,
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
