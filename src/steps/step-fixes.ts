import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../loading-stages'
import { runTaskInMapInst } from '../client/client'
import { assert } from '../misc/assert'
import { assertPhysics } from '../server/physics/is-physics-server'

prestart(() => {
    ig.EVENT_STEP.SHOW_TUTORIAL_START.inject({
        start(data, eventCall) {
            if (!multi.server) return this.parent(data, eventCall)
            ;(data as any).done = true
            ;(data as any).accept = false
        },
    })
})

prestart(() => {
    /* TODO: is this really a solution? */
    ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET.inject({
        start(actor) {
            if (!multi.server) return this.parent(actor)
            assert(ig.game.playerEntity == undefined)
            // @ts-expect-error
            ig.game.playerEntity = {
                hasCameraTarget: () => true,
            }
            this.parent(actor)
            ig.game.playerEntity = undefined as any
        },
    })
})

/* client -> map */
prestart(() => {
    if (!PHYSICS) return

    function runStepOnMap<T extends ig.EventStepBase>(
        this: T & { parent: (data?: unknown, eventCall?: ig.EventCall) => void },
        data?: unknown,
        eventCall?: ig.EventCall
    ) {
        if (!ig.client) return this.parent(data, eventCall)
        return runTaskInMapInst(() => this.parent(data, eventCall))
    }

    ig.EVENT_STEP.MANUAL_COMBATANT_KILL.inject({ start: runStepOnMap })
    ig.EVENT_STEP.ADD_PARTY_MEMBER.inject({ start: runStepOnMap })
    ig.EVENT_STEP.HIDE_ENTITY.inject({ start: runStepOnMap })
    ig.EVENT_STEP.SPAWN_ENEMY.inject({ start: runStepOnMap })
})

/* map -> client */
prestart(() => {
    if (!PHYSICS) return

    ig.EVENT_STEP.ADD_PARTY_MEMBER.inject({
        start(data, eventCall) {
            if (!ig.ccmap) return this.parent(data, eventCall)
            assertPhysics(multi.server)
            const client = ig.ccmap.clients[0]
            assert(client)
            return runTask(client.inst, () => this.parent(data, eventCall))
        },
    })
})
