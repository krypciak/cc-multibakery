import { postload, prestart } from '../loading-stages'
import { deserializeStepSettingsRecursive, serializeStepSettingsRecursive } from './step-settings-serializer'

declare global {
    namespace ig {
        interface Event {
            stepSettings: ig.EventStepBase.Settings[]
        }
    }
}

postload(() => {
    ig.module('multibakery.event-inject')
    ig._loadQueue.unshift(ig._loadQueue.pop()!)
    ig.requires('impact.base.event').defines(() => {
        ig.Event.inject({
            init(settings) {
                this.stepSettings = settings.steps
                this.parent(settings)
            },
        })
    })
})

export type SerializedStepSettings = any

/* copies */
export function serializeEventStepSettings(settings: ig.EventStepBase.Settings): SerializedStepSettings {
    settings = serializeStepSettingsRecursive(settings)
    return settings
}

/* in place */
export function deserializeEventStepSettings(settings: SerializedStepSettings): ig.EventStepBase.Settings {
    deserializeStepSettingsRecursive(settings)
    return settings
}

const eventStepWhitelist = new Set<keyof typeof ig.EVENT_STEP>([
    'ADD_MSG_PERSON',
    'SHOW_MSG',
    'CLEAR_MSG',
    'SHOW_SIDE_MSG',
    'SHOW_BOARD_MSG',
    'SHOW_CHOICE',
    'SHOW_TUTORIAL_MSG',
    'SHOW_GET_MSG',
    'SHOW_CENTER_MSG',
    'SHOW_DREAM_MSG',

    'SET_CAMERA_TARGET',
    'SET_CAMERA_POS',
    'SET_CAMERA_BETWEEN',
    'RESET_CAMERA',
    'UNDO_CAMERA',
    'SET_CAMERA_ZOOM',
    'ADD_PLAYER_CAMERA_TARGET',
    'REMOVE_PLAYER_CAMERA_TARGET',
    'REMOVE_ALL_PLAYER_CAMERAS',

    'SET_SCREEN_BLUR',
    'CLEAR_SCREEN_BLUR',
    'SET_ZOOM_BLUR',
    'FADE_OUT_ZOOM_BLUR',

    'PLAY_BGM',
    'POP_BGM',
    'PUSH_BGM',
    'PAUSE_BGM',
    'RESUME_BGM',
    'SET_DEFAULT_BGM',
    'RESUME_DEFAULT_BGM',
    'PLAY_IN_BETWEEN_BGM',

    'SET_OVERLAY',
    'SHOW_AR_MSG',

    'START_NPC_TRADE_MENU',
    'SHOW_INPUT_DIALOG',
    'SHOW_OBJECT_SLIDER_DIALOG',
])

const eventStepWhitelistClassIds = new Set<number>()
prestart(() => {
    for (const name of eventStepWhitelist) {
        eventStepWhitelistClassIds.add(ig.EVENT_STEP[name].classId)
    }
}, 2000)

export function isStepClassIdInEventStepWhitelist(id: number) {
    return eventStepWhitelistClassIds.has(id)
}
