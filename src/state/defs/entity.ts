import { CCDeepType, EntityTypes } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { addStateHandler } from '../states'
import { assert } from '../../misc/assert'

import './dummy_DummyPlayer'
import './ig_ENTITY_Effect'
// TODO sc.CombatProxyEntity

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

declare global {
    interface StateUpdatePacket {
        states?: Record<string, EntityStateEntry<StateEntityTypes>>
    }
}

function isStateEntity(e: ig.Entity): e is StateEntityInstances {
    return 'getState' in e && 'setState' in e
}

prestart(() => {
    addStateHandler({
        get(packet) {
            packet.states = {}
            for (const entity of ig.game.entities) {
                if (isStateEntity(entity)) {
                    packet.states[entity.uuid] = {
                        type: entity.type,
                        // @ts-expect-error
                        ...entity.getState(),
                    }
                }
            }
        },
        set(packet) {
            if (!packet.states) return

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
        },
    })
}, 1001)
