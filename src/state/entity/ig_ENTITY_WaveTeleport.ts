import { registerNetEntity, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { StateMemory } from '../state-util'
import type { StateKey } from '../map-state-handlers'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import { universalPlayerEntityFix } from '../../server/instance-redirect-fixes'
import { isPhysics } from '../../server/physics/physics-server-types'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { assert } from '../../misc/assert'

declare global {
    namespace ig.ENTITY {
        interface WaveTeleport extends StateMemory.MapHolder<StateKey> {
            retargetPlayerNetid?: EntityNetid
        }
    }
    interface EntityStates {
        'ig.ENTITY.WaveTeleport': Return
    }
}

type Return = ReturnType<typeof getEntityState>
function getEntityState(this: ig.ENTITY.WaveTeleport, player?: StateKey) {
    const memory = StateMemory.getBy(this, player)

    const retargetPlayerNetid = this.retargetPlayerNetid
    this.retargetPlayerNetid = 0

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),
        retargetPlayerNetid: memory.diff(retargetPlayerNetid),
    }
}

function setEntityState(this: ig.ENTITY.WaveTeleport, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.retargetPlayerNetid) {
        const player = ig.game.entitiesByNetid[state.retargetPlayerNetid]
        assert(player instanceof dummy.DummyPlayer)
        const client = player.getClient(true)
        if (client) {
            runTask(client.inst, () => {
                ig.camera.retarget('FASTER', KEY_SPLINES.EASE_IN_OUT)
            })
        }
    }
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
        ballHit: universalPlayerEntityFix(ballLike => [ballLike.getCombatantRoot()]),
        doTeleport() {
            if (!isPhysics(multi.server)) return this.parent()

            const player = this.teleportTargets.find(e => e instanceof dummy.DummyPlayer) as
                | dummy.DummyPlayer
                | undefined
            if (!player) return this.parent()
            const client = player.getClient(true)
            if (!client) return this.parent()

            runTask(client.inst, () => {
                if (ig.camera.isActiveTarget(player.cameraHandle)) this.retargetPlayerNetid = player.netid
                this.parent()
            })
        },
        update() {
            this.retargetPlayerNetid = undefined
            this.parent()
        },
    })
})
