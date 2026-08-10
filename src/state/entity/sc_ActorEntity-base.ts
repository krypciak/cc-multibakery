import { runTask } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import type { StateKey } from '../map-state-handlers'
import { shouldCollectStateData, StateMemory } from '../state-util'
import * as igAnimatedEntity from './ig_AnimatedEntity-base'
import {
    deserializeAction,
    isStepClassIdInActionStepWhitelist,
    serializeAction,
    type ActionId,
    type SerializedAction,
    type StepIndex,
} from './action-serializer'
import type { EntityNetid } from '../../misc/entity-netid'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: sc.ActorEntity, player: StateKey | undefined, memory: StateMemory) {
    let actionStepHistory: ActionStepHistoryEntry[] | undefined = undefined
    this.actionStepHistory = this.actionStepHistory.filter(({ frame }) => frame == ig.system.frame - 1)
    if (this.actionStepHistory.length > 0) {
        actionStepHistory = getActionStepHistory(this, player)
    }

    return {
        ...igAnimatedEntity.getEntityState.call(this, memory),

        face: memory.diffVec2(this.face),
        jumpedWithSound: this.lastJumpWithSoundsFrame == ig.system.frame - 1,

        actionStepHistory,
        hasCurrentAction: memory.diff(!!this.currentAction),
    }
}

export function setEntityState(this: sc.ActorEntity, state: Return) {
    igAnimatedEntity.setEntityState.call(this, state)

    if (state.face) this.face = state.face

    if (state.jumpedWithSound) {
        function getSoundFromColl(
            coll: ig.CollEntry,
            soundType: keyof typeof sc.ACTOR_SOUND = 'none'
        ): sc.ACTOR_SOUND_BASE {
            const terrain = ig.terrain.getTerrain(coll, true, true)
            const entry = sc.ACTOR_SOUND[soundType]
            return (entry as any)[terrain] || entry[ig.TERRAIN_DEFAULT]
        }

        const entry = getSoundFromColl(this.coll, this.soundType)
        ig.SoundHelper.playAtEntity(entry.jump, this, null, null, 700)
    }

    if (state.actionStepHistory && multi.server && !ig.shared.settingStateImmediately) {
        // console.log(JSON.stringify(state.actionStepHistory, null, 4))
        for (const { instPlayerNetid, type, actionUnion, stepIndex } of state.actionStepHistory) {
            let inst = ig.mapShared.ccmap.inst
            if (instPlayerNetid !== undefined) {
                const player = ig.game.entitiesByNetid[instPlayerNetid]
                assert(player instanceof dummy.DummyPlayer)
                const client = player.getClient(true)
                if (client) inst = client.inst
            }

            if (type == 'clearActionAttached') {
                runTask(inst, () => this.clearActionAttached())
                continue
            }
            assert(type == 'start')
            if (actionUnion === undefined) {
                this.currentAction = null
                continue
            }
            const action = getActionFromActionUnion(actionUnion)
            this.currentAction = action

            if (stepIndex === undefined) {
                this.currentActionStep = null
                continue
            }
            const flatStepsArr = this.currentAction.getStepsFlatArray()
            const step = flatStepsArr[stepIndex]
            assert(step)
            this.currentActionStep = step

            assert(isStepClassIdInActionStepWhitelist(step.classId))
            runTask(inst, () => {
                // console.log(fcn(this), 'starting', fcn(step), 'on', inst.name, step.settings)
                step.start(this)
                step.run(this)
            })
        }
    }

    if (state.hasCurrentAction === false) {
        this.currentAction = null
        this.currentActionStep = null
    }
}

declare global {
    namespace sc {
        interface ActorEntity {
            lastJumpWithSoundsFrame?: number
        }
    }
}
prestart(() => {
    sc.ActorEntity.inject({
        onJump(addedHeight, ignoreSounds) {
            this.parent(addedHeight, ignoreSounds)
            if (!ignoreSounds) this.lastJumpWithSoundsFrame = ig.system.frame
        },
    })
})

/* ideally the state key should be GlobalStateKey, but this is good enough */
const actionSettingsEverSent = new WeakMap<StateKey, Set<ActionId>>()

function getActionSettingsToSend(action: Nullable<ig.Action> | undefined, player: StateKey | undefined) {
    if (!action) return
    const actionUniqueId = action.uniqueId
    if (actionUniqueId === undefined || !player) return

    let set = actionSettingsEverSent.get(player)
    if (!set) {
        set = new Set()
        actionSettingsEverSent.set(player, set)
    }
    if (!set.has(actionUniqueId)) {
        set.add(actionUniqueId)
        return serializeAction(action)
    }
}

interface ActionStepHistoryEntry {
    instPlayerNetid?: EntityNetid
    type: 'start' | 'clearActionAttached'

    actionUnion?: {
        settings?: SerializedAction
        uniqueId?: ActionId
    }
    stepIndex?: StepIndex
}

function getActionStepHistory(actor: sc.ActorEntity, player: StateKey | undefined): ActionStepHistoryEntry[] {
    let arr: ActionStepHistoryEntry[] = actor.actionStepHistory.map(entry => {
        const instPlayerNetid = instanceinator.instances[entry.instId]?.ig.client?.dummy?.netid

        if (entry.type == 'clearActionAttached') {
            return {
                instPlayerNetid,
                type: 'clearActionAttached',
            }
        } else {
            const { step, action } = entry
            const actionSettings = getActionSettingsToSend(action, player)
            // if (actionSettings) {
            //     console.log(
            //         'sending',
            //         JSON.stringify(actionSettings.steps).length,
            //         JSON.stringify(actionSettings, null, 4)
            //     )
            // }
            return {
                instPlayerNetid,
                type: 'start',
                actionUnion: {
                    settings: actionSettings ? actionSettings : undefined,
                    uniqueId: !actionSettings ? action.uniqueId : undefined,
                },
                stepIndex: step.stepIndex,
            }
        }
    })
    // remove duplicate entries that have the same action but no stepIndex
    for (let i = arr.length - 1; i >= 1; i--) {
        const v = arr[i]
        const pv = arr[i - 1]
        if (v.actionUnion?.settings !== undefined || pv.actionUnion?.settings !== undefined) continue
        if (v.stepIndex !== undefined || v.actionUnion === undefined) continue
        if (v.actionUnion.uniqueId == pv.actionUnion?.uniqueId) {
            arr.splice(i, 1)
        }
    }

    return arr
}

const deserializedActionCache: Record<ActionId, ig.Action> = {}

function getActionFromActionUnion(union: ActionStepHistoryEntry['actionUnion']): ig.Action {
    assert(union)
    if (union.uniqueId) {
        const action = deserializedActionCache[union.uniqueId]
        assert(action)
        return action
    }
    const settings = union.settings
    assert(settings)
    return (deserializedActionCache[settings.uniqueId] ??= deserializeAction(settings))
}

declare global {
    namespace ig {
        interface ActorEntity {
            actionStepHistory: ({
                frame: number
                instId: number
            } & (
                | {
                      type: 'start'
                      action: ig.Action
                      step: ig.ActionStepBase
                  }
                | { type: 'clearActionAttached' }
            ))[]
        }
    }
}

export function onActionStepStart(action: ig.Action, step: ig.ActionStepBase, _actor: ig.ActorEntity) {
    let actor = _actor as ig.ActorEntity & sc.GetCombatantRoot

    if (!actor.netid) {
        if (!(actor instanceof sc.NPCRunnerEntity)) {
            console.warn('action started on actor', window.fcn?.(actor), 'that doesnt have netid!')
        }
        return
    }

    if (!shouldCollectStateData()) return

    actor.actionStepHistory.push({ frame: ig.system.frame, instId: instanceinator.id, type: 'start', action, step })
}

prestart(() => {
    ig.ActorEntity.inject({
        init(x, y, z, settings) {
            this.actionStepHistory = []
            this.parent(x, y, z, settings)
        },
        clearActionAttached(condition, secondConditionArg) {
            this.parent(condition, secondConditionArg)
            this.actionStepHistory.push({
                frame: ig.system.frame,
                instId: instanceinator.id,
                type: 'clearActionAttached',
            })
        },
    })
})
