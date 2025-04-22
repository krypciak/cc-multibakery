import { CCDeepType, EntityTypes } from '../misc/entity-uuid'
import { assert } from '../misc/assert'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'

import './defs/dummy_DummyPlayer'
import './defs/ig_ENTITY_Effect'
// import './defs/ig_ENTITY_Particle'

interface StateEntityBase {
    getState(): object
    setState(value: object): void
}

type OnlyStateEntityBased<T> = T extends StateEntityBase ? T : never
type Filter<T extends EntityTypes> = OnlyStateEntityBased<InstanceType<CCDeepType<T>>>

export type StateEntityInstances = Filter<EntityTypes>
export type StateEntityTypes = StateEntityInstances['type']

export type EntityStateEntry<T extends StateEntityTypes> = {
    type: T
} & Partial<ReturnType<Filter<T>['getState']>>

export type EntityStateUpdatePacket = {
    states: Record<string, EntityStateEntry<StateEntityTypes>>
}

function isStateEntity(e: ig.Entity): e is StateEntityInstances {
    return 'getState' in e && 'setState' in e
}

export function getFullEntityState({ ig }: InstanceinatorInstance) {
    const packet: EntityStateUpdatePacket = {
        states: {},
    }

    for (const entity of ig.game.entities) {
        if (isStateEntity(entity)) {
            packet.states[entity.uuid] = {
                type: entity.type,
                // @ts-expect-error
                ...entity.getState(),
            }
        }
    }

    return packet
}

declare global {
    namespace ig {
        var settingState: boolean | undefined
        var lastStatePacket: EntityStateUpdatePacket | undefined
    }
}

export function applyEntityStates(packet: EntityStateUpdatePacket, tick: number) {
    ig.settingState = true
    const backup = ig.system.tick
    ig.system.tick = tick
    for (const uuid in packet.states) {
        let entity = ig.game.entitiesByUUID[uuid]
        const data = packet.states[uuid]
        if (!entity) {
            const clazz = ig.entityPathToClass[data.type]
            assert('create' in clazz)
            const create = clazz.create as (uuid: string, state: typeof data) => InstanceType<typeof clazz>
            entity = create(uuid, data)
        }
        assert(entity)
        assert(isStateEntity(entity))
        // @ts-expect-error
        entity.setState(data)
    }

    ig.system.tick = backup
    ig.settingState = false
    ig.lastStatePacket = packet
}

// export function getDiffEntityState(entities: ig.Entity[]) {
//     return getFullEntityState(entities)
// }
