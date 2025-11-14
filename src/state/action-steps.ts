import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { getStepSettings } from '../steps/step-id'
import { EntityNetid } from '../misc/entity-netid'
import { assert } from '../misc/assert'
import { runTask } from 'cc-instanceinator/src/inst-util'

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
                const actor = ig.game.entitiesByNetid[netid]
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

export function onActionStepStart(step: ig.ActionStepBase, actor: ig.ActorEntity) {
    if (!actionStepWhitelist.has(step.classId)) return

    if (!actor.netid) {
        console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        return
    }

    ig.actionStepsFired ??= {}
    ;(ig.actionStepsFired[actor.netid] ??= []).push({
        settings: getStepSettings(step) as ig.ActionStepBase.Settings,
    })
}
