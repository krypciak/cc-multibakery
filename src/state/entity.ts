import { prestart } from '../loading-stages'
import { addStateHandler, StateKey } from './states'
import { assert } from '../misc/assert'
import {
    entityApplyPriority,
    entityIgnoreDeath,
    entitySendEmpty,
    EntityTypeId,
    entityTypeIdToClass,
} from '../misc/entity-netid'
import { encodeJsonSafeNumber } from '../misc/json-safe-encoding'
import { cleanRecord } from './state-util'
import { TemporarySet } from '../misc/temporary-set'

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
import './entity/ig_ENTITY_EnemyCounter'
import './entity/ig_ENTITY_DynamicPlatform'
import './entity/ig_ENTITY_ItemDestruct'
import './entity/ig_ENTITY_XenoDialog'

type EntityStateUnion = EntityStates[keyof EntityStates]

declare global {
    interface EntityStates {}

    interface StateUpdatePacket {
        states?: Record<string, EntityStateUnion> & { entityStateRecordUnion?: never }
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
    const entitiesSpawnedBefore = new TemporarySet<string>(1000)
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
                    packet.states[entity.netid] ??= {} as any
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

                    if (entityIgnoreDeath.has(typeId)) {
                        if (entitiesSpawnedBefore.has(netid)) continue
                        entitiesSpawnedBefore.push(netid)
                    }

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
    settings: ig.Entity.Settings
): string {
    let netid =
        typeId + encodeJsonSafeNumber(Number(`${Math.floor(x)}${Math.floor(y)}${Math.floor(z)}`)) + settings.name
    if (settings.name) netid += settings.name
    return netid
}

const fakeEffect = { coll: { time: {} }, setIgnoreSlowdown() {} }
const fakeEffectSheet = {
    spawnOnTarget: (_name, _target, _settings) => fakeEffect,
    spawnFixed: (_name, _x, _y, _z, _target, _settings) => fakeEffect,
} as ig.EffectSheet

export function createFakeEffectSheet(): ig.EffectSheet {
    return fakeEffectSheet
}
