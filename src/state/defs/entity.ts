import { CCDeepType, EntityTypes } from '../../misc/entity-uuid'
import { prestart } from '../../plugin'
import { addStateHandler } from '../states'
import { assert } from '../../misc/assert'

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

interface StateEntityBase {
    getState(): object | undefined
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
                    // @ts-expect-error
                    const state = entity.getState()
                    if (!state) continue
                    packet.states[entity.uuid] = {
                        type: entity.type,
                        ...state,
                    }
                }
            }
        },
        set(packet) {
            if (!packet.states) return

            const states = Object.entriesT(packet.states).sort(([_, dataA], [__, dataB]) => {
                const classA = ig.entityPathToClass[dataA.type]
                const classB = ig.entityPathToClass[dataB.type]
                const prioA = 'priority' in classA ? classA.priority : 1000
                const prioB = 'priority' in classB ? classB.priority : 1000
                return prioA - prioB
            })

            for (const [uuid, data] of states) {
                let entity: ig.Entity | undefined = ig.game.entitiesByUUID[uuid]
                if (!entity) {
                    const clazz = ig.entityPathToClass[data.type]
                    assert('create' in clazz)
                    const create = clazz.create as (
                        uuid: string,
                        state: typeof data
                    ) => InstanceType<typeof clazz> | undefined
                    entity = create(uuid, data)
                    if (!entity) continue
                }
                assert(entity)
                assert(isStateEntity(entity))
                // @ts-expect-error
                entity.setState(data)
            }
        },
    })
}, 1001)
