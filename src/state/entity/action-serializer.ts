import type { i16, i24 } from 'ts-binarifier/src/type-aliases'
import { prestart } from '../../loading-stages'
import { deserializeStepSettingsRecursive, serializeStepSettingsRecursive } from '../step-settings-serializer'

export type ActionId = i24
export type StepIndex = i16

const uniqueIdOffsest = 100000

function visitStepRecursive<T extends ig.StepBase>(step: T, func: (step: T) => void, seen = new Set<ig.Class>()) {
    if (seen.has(step)) return
    seen.add(step)
    func(step)
    if (step._nextStep) visitStepRecursive(step._nextStep as T, func, seen)
    if (step.branches) {
        for (const branch of Object.values(step.branches)) if (branch) visitStepRecursive(branch as T, func, seen)
    }
}

declare global {
    namespace ig {
        interface Action {
            stepSettings: ig.ActionStepBase.Settings[]
            uniqueId: ActionId
            stepsFlatArray?: ig.ActionStepBase[]

            getStepsFlatArray(): ig.ActionStepBase[]
        }
        interface StepBase {
            stepIndex: StepIndex
        }
    }
}

let actionIdCounter = 0
prestart(() => {
    ig.Action.inject({
        init(name, steps, parallelMove, repeating) {
            this.stepSettings = steps
            this.uniqueId = actionIdCounter++
            this.parent(name, steps, parallelMove, repeating)
        },
        getStepsFlatArray() {
            if (this.stepsFlatArray) return this.stepsFlatArray
            this.stepsFlatArray = []
            if (this.rootStep) visitStepRecursive(this.rootStep, step => this.stepsFlatArray!.push(step))

            return this.stepsFlatArray
        },
    })
})

/* TODO: */
/* this can have entity references! */
/* do we really want to reconstruct the actions entirely? */
/* do we really want to send all the steps and not just the whitelisted ones? */

type SerializedStepSettings = any

export interface SerializedAction {
    uniqueId: ActionId
    name: string
    parallelMove: boolean
    repeating: boolean
    eventAction: boolean
    steps: SerializedStepSettings[]
}

/* copies */
function serializeActionStepSettings(settings: ig.ActionStepBase.Settings): SerializedStepSettings {
    settings = serializeStepSettingsRecursive(settings)
    return settings
}

const serializedActionsCache = new WeakMap<ig.Action, SerializedAction>()
export function serializeAction(action: ig.Action): SerializedAction {
    if (serializedActionsCache.has(action)) return serializedActionsCache.get(action)!

    const whitelistedSteps: ig.ActionStepBase[] = []
    visitStepRecursive(action.rootStep, step => {
        if (isStepClassIdInActionStepWhitelist(step.classId)) whitelistedSteps.push(step)
    })

    for (let i = 0; i < whitelistedSteps.length; i++) {
        const step = whitelistedSteps[i]
        step.stepIndex = i
    }
    const whitelistedStepSettings = whitelistedSteps.map(step => step.settings)

    return {
        uniqueId: action.uniqueId,
        name: action.name ?? '',
        parallelMove: !!action.parallelMove,
        repeating: !!action.repeating,
        eventAction: !!action.eventAction,
        steps: whitelistedStepSettings.map(serializeActionStepSettings),
    }
}

/* in place */
function deserializeActionStepSettings(settings: SerializedStepSettings): ig.ActionStepBase.Settings {
    deserializeStepSettingsRecursive(settings)
    return settings
}

export function deserializeAction({
    uniqueId,
    name,
    parallelMove,
    repeating,
    steps,
    eventAction,
}: SerializedAction): ig.Action {
    const deserializedSteps = steps.map(deserializeActionStepSettings)
    const action = new ig.Action(name, deserializedSteps, parallelMove, repeating)
    action.uniqueId = uniqueId + uniqueIdOffsest
    action.eventAction = eventAction
    return action
}

const actionStepWhitelist = new Set<keyof typeof ig.ACTION_STEP>([
    'PLAY_SOUND',

    'FOCUS_CAMERA',
    'SET_CAMERA_ZOOM',
    'ADD_PLAYER_CAMERA_TARGET',
    'REMOVE_PLAYER_CAMERA_TARGET',
    'RESET_CAMERA',

    'SET_ZOOM_BLUR',
    'FADE_OUT_ZOOM_BLUR',

    'SHOW_AR_MSG',

    /* this.clearActionAttached() callers */
    'CLEAR_STUN_LOCKED',
    'STOP_SOUNDS',
    // 'CLEAR_EFFECTS',
    'CLEAR_TEMP_INFLUENCE',
])

const actionStepWhitelistClassIds = new Set<number>()
prestart(() => {
    for (const name of actionStepWhitelist) {
        actionStepWhitelistClassIds.add(ig.ACTION_STEP[name].classId)
    }
}, 2000)

export function isStepClassIdInActionStepWhitelist(id: number) {
    return actionStepWhitelistClassIds.has(id)
}
