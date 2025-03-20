import { CCDeepType, EntityTypes } from '../misc/entity-uuid'

import './defs/dummy_DummyPlayer'

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

export type EntityStateUpdatePacketRecord = Record<string, EntityStateEntry<StateEntityTypes>>

function isStateEntity(e: ig.Entity): e is StateEntityInstances {
    return 'getState' in e && 'setState' in e
}

export function getFullEntityState(entities: ig.Entity[]) {
    const state: EntityStateUpdatePacketRecord = {}
    for (const entity of entities) {
        if (isStateEntity(entity)) {
            state[entity.uuid] = {
                type: entity.type,
                ...entity.getState(),
            }
        }
    }

    return state
}

export function getDiffEntityState(entities: ig.Entity[]) {
    return getFullEntityState(entities)
}
