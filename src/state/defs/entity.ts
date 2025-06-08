import { prestart } from '../../plugin'
import { addStateHandler } from '../states'
import { assert } from '../../misc/assert'
import { EntityTypeId } from '../../misc/entity-uuid'

import './dummy_DummyPlayer'
import './ig_ENTITY_Effect'
import './ig_ENTITY_PushPullBlock'
import './ig_ENTITY_Switch'
import './ig_ENTITY_OneTimeSwitch'
import './ig_ENTITY_MultiHitSwitch'
import './ig_ENTITY_WallBase'
import './ig_ENTITY_OLPlatform'
import './ig_ENTITY_Ball'
import './sc_CombatProxyEntity'
import './ig_ENTITY_Crosshair'

interface StateEntityBase extends ig.Entity {
    getState(): object | undefined
    setState(value: object): void
}

export type EntityStateEntry = object

declare global {
    interface StateUpdatePacket {
        states?: Record<string, EntityStateEntry>
    }
}

function isStateEntity(e: ig.Entity): e is StateEntityBase {
    return 'getState' in e && 'setState' in e
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.states = {}
            for (const entity of ig.game.entities) {
                if (isStateEntity(entity)) {
                    const state = entity.getState()
                    if (!state) continue
                    packet.states[entity.uuid] = state
                }
            }
        },
        set(packet) {
            if (!packet.states) return

            const states = Object.entriesT(packet.states).map(([k, v]) => {
                const typeId: EntityTypeId = k.substring(0, 2)
                return [typeId, k, v] as const
            })
            states.sort(([typeA], [typeB]) => ig.entityApplyPriority[typeA] - ig.entityApplyPriority[typeB])

            for (const [typeId, uuid, data] of states) {
                let entity: ig.Entity | undefined = ig.game.entitiesByUUID[uuid]
                if (!entity) {
                    const clazz = ig.entityTypeIdToClass[typeId]
                    if (!('create' in clazz)) continue

                    const create = clazz.create as (
                        uuid: string,
                        state: typeof data
                    ) => InstanceType<typeof clazz> | undefined
                    entity = create(uuid, data)
                    if (!entity) continue
                }
                assert(entity)
                assert(isStateEntity(entity))
                entity.setState(data)
            }
        },
    })
}, 1001)

const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()-_=+[]{}|;:,.<>?/`~'
function encodeCustomBase(num: number) {
    if (num === 0) return charset[0]
    const base = charset.length
    let str = ''
    while (num > 0) {
        str = charset[num % base] + str
        num = Math.floor(num / base)
    }
    return str
}

export function createUuidStaticEntity(
    typeId: string,
    x: number,
    y: number,
    z: number,
    _settings: ig.Entity.Settings
): string {
    return typeId + encodeCustomBase(Number(`${x}${y}${z}`))
}
