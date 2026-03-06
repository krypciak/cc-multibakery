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
    ig.EVENT_STEP.SHOW_PARALLAX.inject({
        start(data, eventCall) {
            if (!ig.client) return this.parent(data, eventCall)

            this.parallaxGui = ig.gui.createEventGui(
                '__parallaxGui__',
                'Parallax',
                this.parallaxGui.hook.mapGuiInfo!.settings
            )
            return this.parent(data, eventCall)
        },
    })

    ig.EVENT_STEP.ADD_GUI.inject({
        start(data, eventCall) {
            if (!ig.client) return this.parent(data, eventCall)
            this.guiElement = ig.gui.createEventGui(this.name!, this.guiInfo.type, this.guiInfo.settings)
            return this.parent(data, eventCall)
        },
    })
})

/* client -> map */
prestart(() => {
    if (!PHYSICS) return

    function runStepOnMap<T extends ig.EventStepBase, ARGS extends unknown[], R>(
        this: T & { parent: (...args: ARGS) => R },
        ...args: ARGS
    ): R {
        if (!ig.client) return this.parent(...args)
        return runTaskInMapInst(() => this.parent(...args))
    }

    ig.EVENT_STEP.MANUAL_COMBATANT_KILL.inject({ start: runStepOnMap })
    ig.EVENT_STEP.HIDE_ENTITY.inject({ start: runStepOnMap })
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
