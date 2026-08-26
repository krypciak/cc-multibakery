import type { i24 } from 'ts-binarifier/src/type-aliases'
import { postload, prestart } from '../../loading-stages'
import {
    deserializeStepSettingsRecursive,
    serializeStepSettingsRecursive,
    visitStepRecursive,
} from '../step-settings-serializer'
import type { GlobalStateHandler, GlobalStateKey } from '../global-state-handlers'
import { assert } from '../../misc/assert'
import { addActionStepStartListener } from '../../steps/action-history'
import { shouldCollectStateData } from '../state-util'

export type ActionId = i24

const uniqueIdOffsest = 100000

declare global {
    namespace ig {
        interface Action {
            stepSettings: ig.ActionStepBase.Settings[]
            uniqueId: ActionId
            stepsFlatArray?: ig.ActionStepBase[]

            getStepsFlatArray(): ig.ActionStepBase[]
        }
    }
}

postload(() => {
    ig.module('multibakery.action-inject')
    ig._loadQueue.unshift(ig._loadQueue.pop()!)
    ig.requires('impact.base.action').defines(() => {
        let actionIdCounter = 0
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
})

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
function serializeAction(action: ig.Action): SerializedAction {
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

function deserializeAction({
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

function getActionSettingsToSend(action: Nullable<ig.Action> | undefined, conn: GlobalStateKey | undefined) {
    if (!action) return
    const actionUniqueId = action.uniqueId
    assert(actionUniqueId !== undefined)
    if (!conn) return

    let set = actionSettingsEverSent.get(conn)
    if (!set) {
        set = new Set()
        actionSettingsEverSent.set(conn, set)
    }
    if (!set.has(actionUniqueId)) {
        set.add(actionUniqueId)
        return serializeAction(action)
    }
}
let possibleEventsToSend = new Set<ig.Action>()

addActionStepStartListener(action => {
    if (!shouldCollectStateData()) return

    /* set stepIndex on whitelisted steps */
    serializeAction(action)

    possibleEventsToSend.add(action)
})

declare global {
    interface GlobalStateUpdatePacket {
        actionSettings?: SerializedAction[]
    }
}

const actionSettingsEverSent = new WeakMap<GlobalStateKey, Set<ActionId>>()

export const actionSettingsGlobalStateHandler: GlobalStateHandler = {
    get(packet, conn) {
        const settingsArr: SerializedAction[] = []
        for (const action of possibleEventsToSend) {
            const set = getActionSettingsToSend(action, conn)
            if (set) settingsArr.push(set)
        }
        if (settingsArr.length > 0) {
            packet.actionSettings = settingsArr
        }
    },
    clear() {
        possibleEventsToSend.clear()
    },
    set(packet) {
        if (!packet.actionSettings) return

        for (const settings of packet.actionSettings) {
            actionsToDeserialize[settings.uniqueId] ??= settings
        }
    },
}

const deserializedActionCache: Record<ActionId, ig.Action> = {}
const actionsToDeserialize: Record<ActionId, SerializedAction> = {}
export function getDeserializedActionFromActionId(actionId: ActionId) {
    let action = deserializedActionCache[actionId]
    if (action) return action
    const settings = actionsToDeserialize[actionId]
    assert(settings)
    delete actionsToDeserialize[actionId]
    action = deserializedActionCache[actionId] = deserializeAction(settings)
    return action
}
