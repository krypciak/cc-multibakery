import { assert } from '../misc/assert'
import type { EntityNetid } from '../misc/entity-netid'

/* copies */
export function serializeStepSettingsRecursive(value: any, key: PropertyKey = '') {
    if (typeof value === 'string' || value instanceof ig.LangLabel) return ig.LangLabel.bakeVars(value)
    if (typeof value === 'function') return undefined
    if (!value || typeof value !== 'object') return value

    if (value instanceof ig.Class) {
        if (value instanceof ig.Entity) {
            assert(value.netid)
            return { netid: value.netid }
        }
        if (
            value instanceof sc.InputFieldDialog ||
            value instanceof sc.ObjectSliderDialog ||
            value instanceof ig.Action ||
            value instanceof ig.EventCall
        ) {
            return undefined
        }
        assert(false, `serializeStepSettingsRecursive unknown unhandled class type: ${fcn(value)}`)
    }
    if (key == 'entity' && typeof value == 'object') {
        const entity = ig.Event.getEntity(value)
        if (entity?.netid) return { netid: entity.netid }
        return serializeStepSettingsRecursive(value)
    }

    if (Array.isArray(value)) {
        const newArr: typeof value = new Array(value.length)
        for (let i = 0; i < newArr.length; i++) {
            newArr[i] = serializeStepSettingsRecursive(value[i], i)
        }
        return newArr
    } else {
        const newObj: typeof value = {}
        for (const key in value) {
            newObj[key] = serializeStepSettingsRecursive(value[key], key)
        }
        return newObj
    }
}

/* in place */
export function deserializeStepSettingsRecursive(data: any) {
    if (data && typeof data == 'object') {
        for (const key in data) {
            const value = data[key]
            if (value && typeof value === 'object') {
                if ('netid' in value) {
                    const netid = value.netid as EntityNetid
                    const entity = ig.game.entitiesByNetid[netid]
                    assert(entity)
                    data[key] = entity
                } else {
                    deserializeStepSettingsRecursive(value)
                }
            }
        }
    }
}
