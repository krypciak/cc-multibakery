import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from '../misc/assert'
import type { Client } from './client'

export const clientOptionModelKeysArray = [
    // general
    'skip-tutorials',
    'skip-confirm',
    'text-speed',
    'message-padding',
    // interface
    'circuit-text-size',
    'circuit-display-time',
    'equip-level-display',
    'level-letter-display',
    'buff-help',
    'update-trophy-style',
    'update-quest-style',
    'update-landmark-style',
    'update-lore-style',
    'update-drop-style',
    'min-sidebar',
    'item-hud-size',
    'show-items',
    'show-money',
    'min-quest',
    'quest-show-current',
    'xeno-pointer',
    'hud-display',
    'close-combat-input',
    'close-circle',
    'sp-bar',
    'element-overload',
    'low-health-warning',
    'combat-art-name',
    'damage-numbers',
    'damage-numbers-crit',
    's-rank-effects',
    'enemy-status-bars',
    'hp-bars',
    'party-combat-arts',
    'quick-menu-access',
    'quick-location',
    'quick-element',
    'quick-cursor',
    // video
    'rumble-strength',
    'speedlines',
    'env-particles',
    'weather',
    'lighting',
    // gamepad
    'gamepad-attack',
    'gamepad-dash',
    'gamepad-icons',
    // arena
    'arena-cam-focus',
    'arena-confirm',
    // controls
    'element-wheel',
    // idk custom controls for now not supported
    // 'keys-confirm',
    // 'keys-back',
    // 'keys-menu',
    // 'keys-pause',
    // 'keys-help',
    // 'keys-help2',
    // 'keys-help3',
    // 'keys-skip-cutscene',
    // 'keys-help4',
    // 'keys-circle-left',
    // 'keys-circle-right',
    // 'keys-up',
    // 'keys-right',
    // 'keys-down',
    // 'keys-left',
    // 'keys-melee',
    // 'keys-guard',
    // 'keys-quick',
    // 'keys-special',
    // 'keys-dash2',
    // 'keys-cold',
    // 'keys-shock',
    // 'keys-heat',
    // 'keys-wave',
    // 'keys-neutral',
] as const
type KeyType = (typeof clientOptionModelKeysArray)[number]
export const clientOptionModelKeysSet = new Set(clientOptionModelKeysArray)

export type ClientOptionModelValues = PartialRecord<KeyType, any>

declare global {
    namespace sc {
        interface OptionModel {
            clientValues: ClientOptionModelValues
        }
    }
}

export function initClientOptionModel(client: Client) {
    const clientStorage: sc.OptionModel['clientValues'] = (client.inst.sc.options.clientValues = {})

    client.inst.sc.options.values = new Proxy(multi.server.inst.sc.options.values, {
        get(target, key, receiver) {
            if (typeof key === 'string' && clientOptionModelKeysSet.has(key as KeyType)) {
                return clientStorage[key as KeyType]
            }
            return Reflect.get(target, key, receiver)
        },
        set(target, key, newValue, receiver) {
            if (typeof key === 'string' && clientOptionModelKeysSet.has(key as KeyType)) {
                clientStorage[key as KeyType] = newValue
                return true
            }
            return Reflect.set(target, key, newValue, receiver)
        },
    })
}

export function linkClientOptionModel(mapInst: InstanceinatorInstance) {
    assert(ig.client)

    // technically not needed since all observers are gui related stuff, but just to be safe
    sc.options.observers.push(...mapInst.sc.options.observers)
    sc.options.observers = sc.options.observers.filter(
        o => !('_instanceId' in o) || o._instanceId == ig.client!.inst.id || o._instanceId == mapInst.id
    )
}

export function filterClientOptionModelValues(values: ClientOptionModelValues) {
    return Object.fromEntries(Object.entries(values).filter(([k]) => clientOptionModelKeysSet.has(k as KeyType)))
}

export function loadClientOptionModelState(client: Client, values: ClientOptionModelValues) {
    values = filterClientOptionModelValues(values)
    for (const key in values) {
        client.inst.sc.options.clientValues[key as KeyType] = values[key as KeyType]
    }
}
