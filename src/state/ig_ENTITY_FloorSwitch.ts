import { assert } from '../misc/assert'
import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createNetidStatic } from './entity'
import { StateMemory } from './state-util'
import { StateKey } from './states'

declare global {
    namespace ig.ENTITY {
        interface FloorSwitch {
            lastSent?: WeakMap<StateKey, StateMemory>
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.FloorSwitch, player: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        isOn: memory.diff(this.isOn),
    }
}
function setState(this: ig.ENTITY.FloorSwitch, state: Return) {
    if (state.isOn !== undefined && this.isOn != state.isOn) {
        this.isOn = state.isOn
        const anim = this.isOn ? 'on' : 'off'

        this.setCurrentAnim(anim)
        if (!ig.settingStateImmediately)
            this.effects.sheet.spawnOnTarget(this.isOn ? 'floorSwitchActivate' : 'floorSwitchDeactivate', this)
    }
}

prestart(() => {
    const typeId: EntityTypeId = 'fs'
    ig.ENTITY.FloorSwitch.inject({
        getState,
        setState,
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.FloorSwitch.create = () => {
        throw new Error('ig.ENTITY.FloorSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.FloorSwitch, typeId, netidStatic: true })

    if (REMOTE) {
        ig.ENTITY.FloorSwitch.inject({
            varsChanged() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()
            },
            update() {
                if (!(multi.server instanceof RemoteServer)) return this.parent()
            },
        })
    }
    if (PHYSICSNET) {
        ig.ENTITY.FloorSwitch.inject({
            activate(noDelay) {
                assert(!ig.ignoreEffectNetid)
                ig.ignoreEffectNetid = true
                this.parent(noDelay)
                ig.ignoreEffectNetid = false
            },
            deactivate() {
                assert(!ig.ignoreEffectNetid)
                ig.ignoreEffectNetid = true
                this.parent()
                ig.ignoreEffectNetid = false
            },
        })
    }
}, 2)
