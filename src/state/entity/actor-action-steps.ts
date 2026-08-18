import type { EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData } from '../state-util'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'
import { assert } from '../../misc/assert'
import {
    getDeserializedActionFromActionId,
    isStepClassIdInActionStepWhitelist,
    type ActionId,
    type StepIndex,
} from './action-serializer'
import { runTask } from 'cc-instanceinator/src/inst-util'
import { addActionStepStartListener } from '../../steps/action-history'

declare global {
    interface MapStateOrderedEvents {
        actorActionStep: {
            type: 'actorActionStep'
            netid: EntityNetid

            instPlayerNetid?: EntityNetid
            actionId?: ActionId
            stepIndex?: StepIndex
        }
    }
}

registerOrderedEvent('actorActionStep', {
    set({ netid, instPlayerNetid, actionId, stepIndex }) {
        const actor = ig.game.entitiesByNetid[netid]
        if (!actor) {
            console.warn('actorActionStep actor not found:', netid)
            return
        }
        assert(actor instanceof ig.ActorEntity)

        const inst = getInst(instPlayerNetid)
        if (actionId === undefined) {
            actor.currentAction = null
            return
        }
        const action = getDeserializedActionFromActionId(actionId)
        actor.currentAction = action

        if (stepIndex === undefined) {
            actor.currentActionStep = null
            return
        }
        const flatStepsArr = actor.currentAction.getStepsFlatArray()
        const step = flatStepsArr[stepIndex]
        assert(step)
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

    // if (isStepClassIdInActionStepWhitelist(step.classId)) {
    //     const name = instanceinator.instances[instanceinator.id].name
    //     console.log(fcn(actor), 'starting', fcn(step), 'on', name, step.settings)
    // }

    const player = ig.client?.dummy
    pushOrderedEvent({
        type: 'actorActionStep',
        netid: actor.netid,
        instPlayerNetid: player?.netid,
        actionId: action.uniqueId,
        stepIndex: step.stepIndex,
    })
})

function getInst(instPlayerNetid: number | undefined) {
    let inst = ig.mapShared.ccmap.inst
    if (instPlayerNetid !== undefined) {
        const player = ig.game.entitiesByNetid[instPlayerNetid]
        assert(player instanceof dummy.DummyPlayer)
        const client = player.getClient(true)
        if (client) inst = client.inst
    }
    return inst
}

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

        const inst = getInst(instPlayerNetid)
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
