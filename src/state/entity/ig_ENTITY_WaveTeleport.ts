import { registerNetEntity } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { isPhysics } from '../../server/physics/physics-server-types'
import { runTask } from 'cc-instanceinator/src/inst-util'

declare global {
    namespace ig.ENTITY {
        interface WaveTeleport extends StateMemory.MapHolder<StateKey> {}
    }
    interface EntityStates {
        'ig.ENTITY.WaveTeleport': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.WaveTeleport, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
    }
}

function setEntityState(this: ig.ENTITY.WaveTeleport, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)
}

export function register() {
    ig.ENTITY.WaveTeleport.inject({
        getEntityState,
        setEntityState,
    })
    ig.ENTITY.WaveTeleport.create = () => {
        throw new Error('ig.ENTITY.WaveTeleport.create not implemented')
    }
    registerNetEntity({ entityClass: ig.ENTITY.WaveTeleport })
}

prestart(() => {
    ig.ENTITY.WaveTeleport.inject({
        doTeleport() {
            if (!isPhysics(multi.server)) return this.parent()

            const player = this.teleportTargets.find(e => e instanceof dummy.DummyPlayer) as
                | dummy.DummyPlayer
                | undefined
            if (!player) return this.parent()
            const client = player.getClient(true)
            if (!client) return this.parent()

            runTask(client.inst, () => {
                if (ig.camera.isActiveTarget(player.cameraHandle)) player.retargetCameraFromTeleport = true
                this.parent()
            })
        },
    })
})
