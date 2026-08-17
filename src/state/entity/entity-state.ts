import type { StateKey } from '../map-state-handlers'
import { assert } from '../../misc/assert'
import { entityApplyPriority, type EntityNetid, getEntityTypeId } from '../../misc/entity-netid'
import { cleanRecord } from '../state-util'
import type { MapStateHandler } from '../map-state-handlers'
import { getOrCreateEntityFromState } from './entity-spawn'

export type EntityStateUnion = EntityStates[keyof EntityStates]
export type EntityStateRecord = Record<EntityNetid, EntityStateUnion>

declare global {
    interface EntityStates {}

    interface StateUpdatePacket {
        states?: EntityStateRecord & { entityStateRecordUnion?: never }
    }
}

interface StateEntityBase {
    getEntityState(player?: StateKey, cache?: object): object | undefined
    setEntityState(value: object): void
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

export const entityStateMapStateHandler: MapStateHandler = {
    get(packet, client, cache) {
        for (const entity of ig.game.entities) {
            if (entity._killed) continue
            if (isStateEntity(entity)) {
                let state = entity.getEntityState(client, cache?.states?.[entity.netid])
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

        const states = Object.entries(packet.states).map(([k, v]) => [parseInt(k as string) as EntityNetid, v] as const)
        states.sort(
            ([netidA], [netidB]) =>
                entityApplyPriority[getEntityTypeId(netidA)] - entityApplyPriority[getEntityTypeId(netidB)]
        )

        for (const [netid, state] of states) {
            const entity = getOrCreateEntityFromState(netid, state)
            if (!entity) continue
            assert(isStateEntity(entity))
            entity.setEntityState(state)
        }
    },
}
