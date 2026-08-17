import { entityTypeidToClass, getEntityTypeId, type EntityNetid } from '../../misc/entity-netid'
import { prestart } from '../../loading-stages'
import { shouldCollectStateData } from '../state-util'
import { pushOrderedEvent, registerOrderedEvent } from '../ordered-events'
import type { EntityStateUnion } from '../entity'

declare global {
    interface MapStateOrderedEvents {
        entitySpawn: {
            type: 'entitySpawn'
            netid: EntityNetid
        }
    }
}

function getClassFromNetid(netid: EntityNetid) {
    const typeId = getEntityTypeId(netid)
    const clazz = entityTypeidToClass[typeId]
    return clazz
}

export function getOrCreateEntityFromState(netid: EntityNetid, state: EntityStateUnion): ig.Entity | undefined {
    const entity = ig.game.entitiesByNetid[netid]
    if (entity) return entity

    const clazz = getClassFromNetid(netid)
    if (!clazz.create) return

    return clazz.create(netid, state)
}

registerOrderedEvent('entitySpawn', {
    set({ netid }, packet) {
        const state = packet?.states?.[netid]
        if (!state) return
        getOrCreateEntityFromState(netid, state)
    },
})

prestart(() => {
    if (!PHYSICSNET) return

    function tryPush(entity: ig.Entity) {
        const netid = entity.netid
        if (!netid) return
        if (shouldCollectStateData() && getClassFromNetid(netid)) {
            const typeId = getEntityTypeId(netid)
            const clazz = entityTypeidToClass[typeId]
            if (!clazz.create) return

            pushOrderedEvent({ type: 'entitySpawn', netid })
        }
    }

    ig.Entity.inject({
        init(...args) {
            this.parent(...args)
            tryPush(this)
        },
        reset(...args) {
            this.parent(...args)
            tryPush(this)
        },
    })
}, 4000)
