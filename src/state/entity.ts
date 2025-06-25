import { prestart } from '../plugin'
import { addStateHandler } from './states'
import { assert } from '../misc/assert'
import { entityApplyPriority, entitySendEmpty, EntityTypeId, entityTypeIdToClass } from '../misc/entity-netid'
import { encodeJsonSafeNumber } from '../misc/json-safe-encoding'

import './entity-death'
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
import './ig_ENTITY_CombatantMarble'

declare global {
    interface StateUpdatePacket {
        states?: Record<string, object>
    }
}

interface StateEntityBase {
    getState(full: boolean): object | undefined
    setState(value: object): void
}

function isStateEntity(e: ig.Entity): e is StateEntityBase & ig.Entity {
    return (e.getState && e.setState) as unknown as boolean
}

declare global {
    namespace ig {
        interface Entity extends Partial<StateEntityBase> {}
    }
    interface ImpactClass<Instance> {
        create?(netid: string, state: unknown): ig.Entity | undefined
    }
}

export function getEntityTypeId(netid: string): EntityTypeId {
    return netid?.substring(0, 2)
}

prestart(() => {
    addStateHandler({
        get(packet, full) {
            packet.states = {}
            for (const entity of ig.game.entities) {
                if (isStateEntity(entity)) {
                    const typeId = getEntityTypeId(entity.netid)
                    const state = entity.getState(full)
                    if (
                        !state ||
                        (!entitySendEmpty.has(typeId) && Object.values(state).filter(a => a !== undefined).length == 0)
                    )
                        continue
                    packet.states[entity.netid] = state
                }
            }
        },
        set(packet) {
            if (!packet.states) return

            const states = Object.entriesT(packet.states).map(([k, v]) => [getEntityTypeId(k), k, v] as const)
            states.sort(([typeA], [typeB]) => entityApplyPriority[typeA] - entityApplyPriority[typeB])

            for (const [typeId, netid, data] of states) {
                let entity: ig.Entity | undefined = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    const clazz = entityTypeIdToClass[typeId]
                    if (!clazz.create) continue

                    entity = clazz.create(netid, data)
                    if (!entity) continue
                }
                assert(entity)
                assert(isStateEntity(entity))
                entity.setState(data)
            }
        },
    })
}, 1001)

export function createNetidStaticEntity(
    typeId: string,
    x: number,
    y: number,
    z: number,
    _settings: ig.Entity.Settings
): string {
    return typeId + encodeJsonSafeNumber(Number(`${x}${y}${z}`))
}
