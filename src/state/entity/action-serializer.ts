import { postload, prestart } from '../../loading-stages'
import { deserializeStepSettingsRecursive, serializeStepSettingsRecursive } from '../step-settings-serializer'

declare global {
    namespace ig {
        interface Action {
            stepSettings: ig.ActionStepBase.Settings[]
            stepsFlatArray?: ig.ActionStepBase[]
        }
    }
}

postload(() => {
    ig.module('multibakery.action-inject')
    ig._loadQueue.unshift(ig._loadQueue.pop()!)
    ig.requires('impact.base.action').defines(() => {
        ig.Action.inject({
            init(name, steps, parallelMove, repeating) {
                this.stepSettings = steps
                this.parent(name, steps, parallelMove, repeating)
            },
        })
    })
})

export type SerializedStepSettings = any

export interface SerializedAction {
    parallelMove: boolean
    repeating: boolean
    eventAction: boolean
}

/* copies */
export function serializeActionStepSettings(settings: ig.ActionStepBase.Settings): SerializedStepSettings {
    settings = serializeStepSettingsRecursive(settings)
    return settings
}

/* in place */
export function deserializeActionStepSettings(settings: SerializedStepSettings): ig.ActionStepBase.Settings {
    deserializeStepSettingsRecursive(settings)
    return settings
}

export function serializeAction(action: ig.Action): SerializedAction {
    return {
        parallelMove: !!action.parallelMove,
        repeating: !!action.repeating,
        eventAction: !!action.eventAction,
    }
}

export function deserializeAction({ parallelMove, repeating, eventAction }: SerializedAction): ig.Action {
    const action = new ig.Action('REMOTE_ACTION', [], parallelMove, repeating)
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
