import type { EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData } from '../state-util'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'
import { assert } from '../../misc/assert'
import {
    deserializeAction,
    deserializeActionStepSettings,
    isStepClassIdInActionStepWhitelist,
    serializeAction,
    serializeActionStepSettings,
    type SerializedAction,
    type SerializedStepSettings,
} from './action-serializer'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { addActionStepStartListener } from '../../steps/action-history'
import { getInstFromInstPlayerNetid } from '../step-settings-serializer'

declare global {
    interface MapStateOrderedEvents {
        actorActionStep: {
            type: 'actorActionStep'
            netid: EntityNetid

            instPlayerNetid?: EntityNetid
            actionSettings: SerializedAction
            stepSettings?: SerializedStepSettings
        }
    }
}

registerOrderedEvent('actorActionStep', {
    set({ netid, instPlayerNetid, actionSettings, stepSettings }) {
        const actor = ig.game.entitiesByNetid[netid]
        if (!actor) {
            if (stepSettings !== undefined) {
                console.warn('actorActionStep actor not found:', netid, 'failed to run a step')
            }
            return
        }
        assert(actor instanceof ig.ActorEntity)

        const inst = getInstFromInstPlayerNetid(instPlayerNetid)
        if (actionSettings === undefined) {
            actor.currentAction = null
            return
        }
        const action = deserializeAction(actionSettings)
        actor.currentAction = action

        if (stepSettings === undefined) {
            actor.currentActionStep = null
            return
        }
        const stepSettingsDeserialized = deserializeActionStepSettings(stepSettings)
        const step = ig.StepHelpers.constructSteps(
            [stepSettingsDeserialized],
            ig.ACTION_STEP,
            action.labeledSteps
        ) as ig.ActionStepBase

        actor.currentActionStep = step

        assert(isStepClassIdInActionStepWhitelist(step.classId))
        runTask(inst, () => {
            // console.log(fcn(actor), 'starting', fcn(step), 'on', inst.name, step.settings)
            step.start(actor)
            step.run(actor)
        })
    },
})

addActionStepStartListener((action, step, _actor) => {
    let actor = _actor as ig.ActorEntity & sc.GetCombatantRoot

    if (!actor.netid) {
        if (!(actor instanceof sc.NPCRunnerEntity)) {
            console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        }
        return
    }

    if (!shouldCollectStateData()) return

    const actionSettings = serializeAction(action)

    const stepSettings = isStepClassIdInActionStepWhitelist(step.classId)
        ? serializeActionStepSettings(step.settings)
        : undefined

    // if (isStepClassIdInActionStepWhitelist(step.classId)) {
    //     const name = instanceinator.instances[instanceinator.id].name
    //     console.log(fcn(actor), 'starting', fcn(step), 'on', name, step.settings)
    // }

    const player = ig.client?.dummy
    pushOrderedEvent({
        type: 'actorActionStep',
        netid: actor.netid,
        instPlayerNetid: player?.netid,
        actionSettings,
        stepSettings,
    })
})

declare global {
    interface MapStateOrderedEvents {
        actorClearActionAttached: {
            type: 'actorClearActionAttached'
            netid: EntityNetid
            instPlayerNetid?: EntityNetid
        }
    }
}
registerOrderedEvent('actorClearActionAttached', {
    set({ netid, instPlayerNetid }) {
        const actor = ig.game.entitiesByNetid[netid]
        if (!actor) return
        assert(actor instanceof ig.ActorEntity)

        const inst = getInstFromInstPlayerNetid(instPlayerNetid)
        runTask(inst, () => actor.clearActionAttached())
    },
})

prestart(() => {
    if (!PHYSICSNET) return

    ig.ActorEntity.inject({
        clearActionAttached(condition, secondConditionArg) {
            const origLen = this.actionAttached.length
            this.parent(condition, secondConditionArg)
            if (condition || secondConditionArg || origLen == 0 || !shouldCollectStateData()) return

            pushOrderedEvent({
                type: 'actorClearActionAttached',
                netid: this.netid,
                instPlayerNetid: ig.client?.dummy?.netid,
            })
        },
    })
})
