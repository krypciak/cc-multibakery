import { prestart } from '../loading-stages'
import { addStateHandler, type StateKey } from './states'
import { assert } from '../misc/assert'
import { entityApplyPriority, type EntityNetid, entityTypeidToClass, getEntityTypeId } from '../misc/entity-netid'
import { cleanRecord } from './state-util'

import './entity/entity-death'
import './entity/entity-hit-effect'

/* these modules cannot export anything,
 * or else it might screw up import order
 * and therefore screw up binary encoding */
import './entity/dummy_DummyPlayer'
import './entity/ig_ENTITY_Effect'
import './entity/ig_ENTITY_PushPullBlock'
import './entity/ig_ENTITY_Switch'
import './entity/ig_ENTITY_OneTimeSwitch'
import './entity/ig_ENTITY_MultiHitSwitch'
import './entity/ig_ENTITY_WallHorizontal'
import './entity/ig_ENTITY_WallVertical'
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
import './entity/sc_PartyMemberEntity'

type EntityStateUnion = EntityStates[keyof EntityStates]

declare global {
    interface EntityStates {}

    interface StateUpdatePacket {
        states?: Record<EntityNetid, EntityStateUnion> & { entityStateRecordUnion?: never }
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
        create?(netid: EntityNetid, state: unknown): ig.Entity | undefined
    }
}

prestart(() => {
    addStateHandler({
        get(packet, client, cache) {
            for (const entity of ig.game.entities) {
                if (entity._killed) continue
                if (isStateEntity(entity)) {
                    let state = entity.getState(client, cache?.states?.[entity.netid])
                    if (!state) continue
                    state = cleanRecord(state)
                    if (!state) continue

                    packet.states ??= {}
                    packet.states[entity.netid] ??= {} as any
                    Object.assign(packet.states[entity.netid], state)
                }
            }
        },
        set(packet) {
            if (!packet.states) return

            const states = Object.entriesT(packet.states).map(([k, v]) => {
                const netid: EntityNetid = parseInt(k as string)

                return [getEntityTypeId(netid), netid, v] as const
            })
            states.sort(([typeA], [typeB]) => entityApplyPriority[typeA] - entityApplyPriority[typeB])

            for (const [typeId, netid, data] of states) {
                let entity: ig.Entity | undefined = ig.game.entitiesByNetid[netid]
                if (!entity) {
                    const clazz = entityTypeidToClass[typeId]
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

const fakeEffect = { coll: { time: {} }, setIgnoreSlowdown() {} }
const fakeEffectSheet = {
    spawnOnTarget: (_name, _target, _settings) => fakeEffect,
    spawnFixed: (_name, _x, _y, _z, _target, _settings) => fakeEffect,
} as ig.EffectSheet

export function createFakeEffectSheet(): ig.EffectSheet {
    return fakeEffectSheet
}
