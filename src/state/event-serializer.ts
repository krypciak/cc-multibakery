import type { i24 } from 'ts-binarifier/src/type-aliases'
import { postload, prestart } from '../loading-stages'
import {
    deserializeStepSettingsRecursive,
    serializeStepSettingsRecursive,
    visitStepRecursive,
} from './step-settings-serializer'
import type { GlobalStateHandler, GlobalStateKey } from './global-state-handlers'
import { assert } from '../misc/assert'
import { shouldCollectStateData } from './state-util'

export type EventId = i24

const uniqueIdOffsest = 100000

declare global {
    namespace ig {
        interface Event {
            stepSettings: ig.EventStepBase.Settings[]
            uniqueId: EventId
            stepsFlatArray?: ig.EventStepBase[]

            getStepsFlatArray(): ig.EventStepBase[]
        }
    }
}

postload(() => {
    ig.module('multibakery.event-inject')
    ig._loadQueue.unshift(ig._loadQueue.pop()!)
    ig.requires('impact.base.event').defines(() => {
        let eventIdCounter = 0
        ig.Event.inject({
            init(settings) {
                this.stepSettings = settings.steps
                this.uniqueId = eventIdCounter++
                this.parent(settings)
            },
            getStepsFlatArray() {
                if (this.stepsFlatArray) return this.stepsFlatArray
                this.stepsFlatArray = []
                if (this.rootStep) visitStepRecursive(this.rootStep, step => this.stepsFlatArray!.push(step))

                return this.stepsFlatArray
            },
        })
    })
})

type SerializedStepSettings = any

export interface SerializedEvent {
    uniqueId: EventId
    name?: string
    steps: SerializedStepSettings[]
}

/* copies */
function serializeEventStepSettings(settings: ig.EventStepBase.Settings): SerializedStepSettings {
    settings = serializeStepSettingsRecursive(settings)
    return settings
}

const serializedEventsCache = new WeakMap<ig.Event, SerializedEvent>()
function serializeEvent(event: ig.Event): SerializedEvent {
    if (serializedEventsCache.has(event)) return serializedEventsCache.get(event)!

    const whitelistedSteps: ig.EventStepBase[] = []
    visitStepRecursive(event.rootStep, step => {
        if (isStepClassIdInEventStepWhitelist(step.classId)) whitelistedSteps.push(step)
    })

    for (let i = 0; i < whitelistedSteps.length; i++) {
        const step = whitelistedSteps[i]
        step.stepIndex = i
    }
    const whitelistedStepSettings = whitelistedSteps.map(step => step.settings)

    return {
        uniqueId: event.uniqueId,
        name: event.name == '[UNNAMED]' ? undefined : event.name,
        steps: whitelistedStepSettings.map(serializeEventStepSettings),
    }
}

/* in place */
function deserializeEventStepSettings(settings: SerializedStepSettings): ig.EventStepBase.Settings {
    deserializeStepSettingsRecursive(settings)
    return settings
}

function deserializeEvent({ uniqueId, name, steps }: SerializedEvent): ig.Event {
    const deserializedSteps = steps.map(deserializeEventStepSettings)
    const event = new ig.Event({ name, steps: deserializedSteps })
    event.uniqueId = uniqueId + uniqueIdOffsest
    return event
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

function getEventSettingsToSend(event: Nullable<ig.Event> | undefined, conn: GlobalStateKey | undefined) {
    if (!event) return
    const eventUniqueId = event.uniqueId
    assert(eventUniqueId !== undefined)
    if (!conn) return

    let set = eventSettingsEverSent.get(conn)
    if (!set) {
        set = new Set()
        eventSettingsEverSent.set(conn, set)
    }
    if (!set.has(eventUniqueId)) {
        set.add(eventUniqueId)
        return serializeEvent(event)
    }
}
let possibleEventsToSend = new Set<ig.Event>()

prestart(() => {
    ig.EventCall.inject({
        init(event, ...args) {
            this.parent(event, ...args)

            if (!shouldCollectStateData()) return

            /* set stepIndex on whitelisted steps */
            serializeEvent(event)

            possibleEventsToSend.add(event)
        },
    })
})

declare global {
    interface GlobalStateUpdatePacket {
        eventSettings?: SerializedEvent[]
    }
}

const eventSettingsEverSent = new WeakMap<GlobalStateKey, Set<EventId>>()

export const eventSettingsGlobalStateHandler: GlobalStateHandler = {
    get(packet, conn) {
        const settingsArr: SerializedEvent[] = []
        for (const event of possibleEventsToSend) {
            const set = getEventSettingsToSend(event, conn)
            if (set) settingsArr.push(set)
        }
        if (settingsArr.length > 0) {
            packet.eventSettings = settingsArr
        }
    },
    clear() {
        possibleEventsToSend.clear()
    },
    set(packet) {
        if (!packet.eventSettings) return

        for (const settings of packet.eventSettings) {
            deserializedEventCache[settings.uniqueId] ??= deserializeEvent(settings)
        }
    },
}

const deserializedEventCache: Record<EventId, ig.Event> = {}
export function getDeserializedEventFromEventId(eventId: EventId) {
    const event = deserializedEventCache[eventId]
    assert(event)
    return event
}
