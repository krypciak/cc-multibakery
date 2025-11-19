import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import { getStepSettings } from '../steps/step-id'
import { EntityNetid } from '../misc/entity-netid'
import { assert } from '../misc/assert'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { shouldCollectStateData } from './state-util'
import { runTaskInMapInst } from '../client/client'

interface StepObj {
    settings: any //ig.ActionStepBase.Settings
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
        get(packet, client) {
            if (!client) return
            const netid = client.dummy.netid
            const entry = ig.actionStepsFired?.[netid]
            if (!entry) return

            packet.actionSteps ??= {}
            packet.actionSteps[netid] = entry
        },
        clear() {
            ig.actionStepsFired = undefined
        },
        set(packet) {
            if (!packet.actionSteps) return

            for (const netidStr in packet.actionSteps) {
                const netid = netidStr as unknown as EntityNetid
                const player = ig.game.entitiesByNetid[netid]
                assert(player instanceof dummy.DummyPlayer)
                const client = player.getClient()
                runTask(client.inst, () => {
                    const steps: ig.ActionStepBase.Settings[] = packet.actionSteps![netid].map(
                        ({ settings }) => settings
                    )
                    const action = new ig.Action(`multibakery-remote-action`, steps)

                    player.currentAction = action

                    action.run(player)

                    player.currentAction = null
                    player.currentActionStep = null
                })
            }
        },
    })
}, 200)

let actionStepWhitelist: Set<number>
prestart(() => {
    actionStepWhitelist = new Set(
        [
            ig.ACTION_STEP.PLAY_SOUND,
            ig.ACTION_STEP.FOCUS_CAMERA,
            ig.ACTION_STEP.SET_ZOOM_BLUR,
            ig.ACTION_STEP.SET_CAMERA_ZOOM,
            ig.ACTION_STEP.RESET_CAMERA,

            /* this.clearActionAttached() callers */
            ig.ACTION_STEP.CLEAR_STUN_LOCKED,
            ig.ACTION_STEP.STOP_SOUNDS,
            // ig.ACTION_STEP.CLEAR_EFFECTS,
            ig.ACTION_STEP.CLEAR_TEMP_INFLUENCE,
        ].map(clazz => clazz.classId)
    )
}, 2000)

export function onActionStepStart(step: ig.ActionStepBase, actor: ig.ActorEntity) {
    if (!actionStepWhitelist.has(step.classId)) return
    if (actor instanceof dummy.DummyPlayer) assert(ig.client)

    if (!actor.netid) {
        console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        return
    }

    if (shouldCollectStateData()) {
        runTaskInMapInst(() => {
            ig.actionStepsFired ??= {}
            ;(ig.actionStepsFired[actor.netid] ??= []).push({
                settings: getStepSettings(step) as ig.ActionStepBase.Settings,
            })
        })
    }
}

declare global {
    interface StateUpdatePacket {
        clearActionAttached?: Record<EntityNetid, true>
    }
    namespace ig {
        var clearActionAttached: Record<EntityNetid, true> | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (!client || !ig.clearActionAttached) return
            const netid = client.dummy.netid
            if (!ig.clearActionAttached[netid]) return

            packet.clearActionAttached ??= {}
            packet.clearActionAttached[netid] = ig.clearActionAttached[netid]
        },
        clear() {
            ig.clearActionAttached = undefined
        },
        set(packet) {
            if (!packet.clearActionAttached) return

            for (const netidStr in packet.clearActionAttached) {
                const netid = netidStr as unknown as EntityNetid
                const player = ig.game.entitiesByNetid[netid]
                assert(player instanceof dummy.DummyPlayer)
                const client = player.getClient()
                runTask(client.inst, () => {
                    player.clearActionAttached()
                })
            }
        },
    })
})

prestart(() => {
    dummy.DummyPlayer.inject({
        clearActionAttached(condition, secondConditionArg) {
            if (!multi.server) return this.parent(condition, secondConditionArg)

            if (!condition && this.actionAttached.length > 0 && shouldCollectStateData()) {
                // console.log('clearActionAttached', this.actionAttached.map(fcn), condition, secondConditionArg)
                assert(!secondConditionArg)
                assert(ig.client)
                runTaskInMapInst(() => {
                    ig.clearActionAttached ??= {}
                    ig.clearActionAttached[this.netid] = true
                })
            }

            this.parent(condition)
        },
    })
})
