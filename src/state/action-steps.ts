import { prestart } from '../loading-stages'
import { addStateHandler } from './states'
import type { EntityNetid } from '../misc/entity-netid'
import { assert } from '../misc/assert'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { shouldCollectStateData } from './state-util'

interface StepObj {
    settings: any //ig.ActionStepBase.Settings
}

declare global {
    interface StateUpdatePacket {
        actionSteps?: Record<EntityNetid, StepObj[]>
    }
    namespace ig {
        interface MapSharedVars {
            actionStepsFired?: Record<EntityNetid, StepObj[]>
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (!client) return
            const netid = client.dummy.netid
            const entry = ig.mapShared.actionStepsFired?.[netid]
            if (!entry) return

            packet.actionSteps ??= {}
            packet.actionSteps[netid] = entry
        },
        clear() {
            ig.mapShared.actionStepsFired = undefined
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
            ig.ACTION_STEP.SET_CAMERA_ZOOM,
            ig.ACTION_STEP.ADD_PLAYER_CAMERA_TARGET,
            ig.ACTION_STEP.REMOVE_PLAYER_CAMERA_TARGET,
            ig.ACTION_STEP.RESET_CAMERA,

            ig.ACTION_STEP.SET_ZOOM_BLUR,
            ig.ACTION_STEP.FADE_OUT_ZOOM_BLUR,

            ig.ACTION_STEP.SHOW_AR_MSG,

            /* this.clearActionAttached() callers */
            ig.ACTION_STEP.CLEAR_STUN_LOCKED,
            ig.ACTION_STEP.STOP_SOUNDS,
            // ig.ACTION_STEP.CLEAR_EFFECTS,
            ig.ACTION_STEP.CLEAR_TEMP_INFLUENCE,
        ].map(clazz => clazz.classId)
    )
}, 2000)

export function onActionStepStart(step: ig.ActionStepBase, _actor: ig.ActorEntity) {
    let actor = _actor as ig.ActorEntity & sc.GetCombatantRoot
    if (!actionStepWhitelist.has(step.classId)) return
    if (actor.getCombatantRoot) {
        const old = actor
        actor = actor.getCombatantRoot()
        if (fcn(old) != fcn(actor)) {
            console.log('getcombatantroot', fcn(old), fcn(actor))
        }
    }

    if (!actor.netid) {
        console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        return
    }

    if (shouldCollectStateData()) {
        ig.mapShared.actionStepsFired ??= {}
        ;(ig.mapShared.actionStepsFired[actor.netid] ??= []).push({
            settings: ig.StepHelpers.getStepSettings(step) as ig.ActionStepBase.Settings,
        })
    }
}

declare global {
    interface StateUpdatePacket {
        clearActionAttached?: Record<EntityNetid, true>
    }
    namespace ig {
        interface MapSharedVars {
            clearActionAttached?: Record<EntityNetid, true>
        }
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client) {
            if (!client || !ig.mapShared.clearActionAttached) return
            const netid = client.dummy.netid
            if (!ig.mapShared.clearActionAttached[netid]) return

            packet.clearActionAttached ??= {}
            packet.clearActionAttached[netid] = ig.mapShared.clearActionAttached[netid]
        },
        clear() {
            ig.mapShared.clearActionAttached = undefined
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
                ig.mapShared.clearActionAttached ??= {}
                ig.mapShared.clearActionAttached[this.netid] = true
            }

            this.parent(condition)
        },
    })
})
