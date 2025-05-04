import { prestart } from '../../plugin'

export {}
declare global {
    namespace ig.ENTITY {
        interface Switch {
            type: 'ig.ENTITY.Switch'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface SwitchConstructor {
            create(uuid: string, state: Return): ig.ENTITY.Switch
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: ig.ENTITY.Switch) {
    return {
        isOn: this.isOn ? true : undefined,
    }
}
function setState(this: ig.ENTITY.Switch, state: Return) {
    const isOn = !!state.isOn
    if (this.isOn != isOn) {
        this.isOn = isOn
        this.setCurrentAnim(this.isOn ? 'switchOn' : 'switchOff', true, this.isOn ? 'on' : 'off', true)
        ig.SoundHelper.playAtEntity(this.sounds.hit, this)
        ig.SoundHelper.playAtEntity(this.sounds.bing, this)
    }
}

prestart(() => {
    ig.ENTITY.Switch.inject({ getState, setState })
    ig.ENTITY.Switch.create = (uuid: string, state) => {
        throw new Error('ig.ENTITY.Switch.create not implemented')
        // const entity = ig.game.spawnEntity<ig.ENTITY.Switch, ig.ENTITY.Switch.Settings>(
        //     ig.ENTITY.Switch,
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
