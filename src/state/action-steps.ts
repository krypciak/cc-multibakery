import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { getStepSettings } from '../steps/step-id'
import { EntityNetid } from '../misc/entity-netid'
import { assert } from '../misc/assert'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { PhysicsServer } from '../server/physics/physics-server'

interface StepObj {
    settings: ig.ActionStepBase.Settings
}

declare global {
    interface StateUpdatePacket {
        actionSteps?: Record<EntityNetid, StepObj[]>
    }
    namespace ig {
        var actionStepsFired: Record<EntityNetid, StepObj[]> | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet) {
            if (!ig.actionStepsFired) return

            packet.actionSteps ??= {}
            for (const netidStr in ig.actionStepsFired) {
                const netid = netidStr as unknown as EntityNetid
                ;(packet.actionSteps[netid] ??= []).push(...ig.actionStepsFired[netid])
            }
        },
        clear() {
            ig.actionStepsFired = undefined
        },
        set(packet) {
            if (!packet.actionSteps) return

            for (const netidStr in packet.actionSteps) {
                const netid = netidStr as unknown as EntityNetid
                const actor = ig.game.entitiesByNetid[netid] ?? ig.ccmap?.clients[0]?.dummy
                assert(actor)
                assert(actor instanceof ig.ActorEntity)
                const run = () => {
                    const steps: ig.ActionStepBase.Settings[] = packet.actionSteps![netid].map(
                        ({ settings }) => settings
                    )
                    const action = new ig.Action(`multibakery-remote-action`, steps)

                    actor.currentAction = action

                    action.run(actor)

                    actor.currentAction = null
                    actor.currentActionStep = null
                }

                if (actor instanceof dummy.DummyPlayer) {
                    const client = actor.getClient(true)
                    if (client) {
                        runTask(client.inst, run)
                        continue
                    }
                }
                run()
            }
        },
    })
})

let actionStepWhitelist: Set<number>
prestart(() => {
    actionStepWhitelist = new Set(
        [
            ig.ACTION_STEP.PLAY_SOUND,
            ig.ACTION_STEP.FOCUS_CAMERA,
            ig.ACTION_STEP.SET_ZOOM_BLUR,
            ig.ACTION_STEP.SET_CAMERA_ZOOM,
            ig.ACTION_STEP.RESET_CAMERA,
        ].map(clazz => clazz.classId)
    )
}, 2000)

function pushActionhStep(actor: ig.ActorEntity, settings: ig.ActionStepBase.Settings) {
    ig.actionStepsFired ??= {}
    ;(ig.actionStepsFired[actor.netid] ??= []).push({
        settings,
    })
}
export function onActionStepStart(step: ig.ActionStepBase, actor: ig.ActorEntity) {
    if (!actionStepWhitelist.has(step.classId)) return

    if (!actor.netid) {
        console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        return
    }

    pushActionhStep(actor, getStepSettings(step) as ig.ActionStepBase.Settings)
}

prestart(() => {
    if (!PHYSICSNET) return

    ig.Camera.TargetHandle.inject({
        onActionEndDetach(entity) {
            this.parent(entity)
            if (!(multi.server instanceof PhysicsServer)) return
            pushActionhStep(entity, { type: 'RESET_CAMERA', speed: 'FAST' })
        },
    })
})
