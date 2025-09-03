import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { assert } from '../misc/assert'
import { entityApplyPriority, entitySendEmpty, EntityTypeId, entityTypeIdToClass } from '../misc/entity-netid'
import { encodeJsonSafeNumber } from '../misc/json-safe-encoding'
import { cleanRecord } from './state-util'

import './entity/entity-death'
import './entity/entity-hit-effect'

import './entity/dummy_DummyPlayer'
import './entity/ig_ENTITY_Effect'
import './entity/ig_ENTITY_PushPullBlock'
import './entity/ig_ENTITY_Switch'
import './entity/ig_ENTITY_OneTimeSwitch'
import './entity/ig_ENTITY_MultiHitSwitch'
import './entity/ig_ENTITY_WallBase'
import './entity/ig_ENTITY_OLPlatform'
import './entity/ig_ENTITY_Ball'
import './entity/sc_CombatProxyEntity'
import './entity/ig_ENTITY_Crosshair'
import './entity/ig_ENTITY_Enemy'
import './entity/ig_ENTITY_CombatantMarble'
import './entity/sc_ItemDropEntity'
import './entity/ig_ENTITY_Chest'
import './entity/ig_ENTITY_FloorSwitch'
import './entity/ig_ENTITY_NPC'
import './entity/ig_ENTITY_BounceBlock'
import './entity/ig_ENTITY_BounceSwitch'
import './entity/ig_ENTITY_Destructible'

declare global {
    interface StateUpdatePacket {
        states?: Record<string, object>
    }
}

interface StateEntityBase {
    getState(player?: StateKey, cache?: object): object | undefined
    setState(value: object): void
}

function isStateEntity(e: ig.Entity): e is StateEntityBase & ig.Entity {
    return !!e.netid
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
        get(packet, player, cache) {
            for (const entity of ig.game.entities) {
                if (isStateEntity(entity)) {
                    const typeId = getEntityTypeId(entity.netid)

                    let state = entity.getState(player, cache?.states?.[entity.netid])
                    if (!state) continue
                    state = cleanRecord(state)
                    if (!state) {
                        if (entitySendEmpty.has(typeId)) {
                            state = {}
                        } else {
                            continue
                        }
                    }

                    packet.states ??= {}
                    packet.states[entity.netid] ??= {}
                    Object.assign(packet.states[entity.netid], state)
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
}, 5)

export function createNetidStatic(
    typeId: string,
    x: number,
    y: number,
    z: number,
    _settings: ig.Entity.Settings
): string {
    return typeId + encodeJsonSafeNumber(Number(`${x}${y}${z}`))
}

const fakeEffect = { coll: { time: {} }, setIgnoreSlowdown() {} }
const fakeEffectSheet = {
    spawnOnTarget: (_name, _target, _settings) => fakeEffect,
    spawnFixed: (_name, _x, _y, _z, _target, _settings) => fakeEffect,
} as ig.EffectSheet

export function createFakeEffectSheet(): ig.EffectSheet {
    return fakeEffectSheet
}
