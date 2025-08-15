import { EntityTypeId, registerNetEntity } from '../misc/entity-netid'
import { prestart } from '../plugin'
import { RemoteServer } from '../server/remote/remote-server'
import { createNetidStatic } from './entity'
import { StateMemory } from './state-util'
import { ServerPlayer } from '../server/server-player'

declare global {
    namespace ig.ENTITY {
        interface OneTimeSwitch {
            lastSent?: WeakMap<ServerPlayer, StateMemory>
        }
    }
}

type Return = ReturnType<typeof getState>
function getState(this: ig.ENTITY.OneTimeSwitch, player: ServerPlayer) {
    const memory = StateMemory.getStateMemory(this, player)

    return {
        isOn: memory.isSameAsLast(this.isOn),
    }
}
function setState(this: ig.ENTITY.OneTimeSwitch, state: Return) {
    if (state.isOn !== undefined && this.isOn != state.isOn) {
        this.isOn = state.isOn
        if (this.isOn) {
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
        createNetid(x, y, z, settings) {
            return createNetidStatic(typeId, x, y, z, settings)
        },
    })
    ig.ENTITY.OneTimeSwitch.create = () => {
        throw new Error('ig.ENTITY.OneTimeSwitch.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.OneTimeSwitch, typeId, netidStatic: true })

    if (!REMOTE) return

    ig.ENTITY.OneTimeSwitch.inject({
        ballHit(ball) {
            if (!(multi.server instanceof RemoteServer)) return this.parent(ball)
            return false
        },
        varsChanged() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
        },
    })
}, 2)
