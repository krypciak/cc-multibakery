import type { i16 } from 'ts-binarifier/src/type-aliases'
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

/* step util functions */
export type StepIndex = i16
declare global {
    namespace ig {
        interface StepBase {
            stepIndex?: StepIndex
        }
    }
}

export function visitStepRecursive<T extends ig.StepBase>(
    step: T,
    func: (step: T) => void,
    seen = new Set<ig.Class>()
) {
    if (seen.has(step)) return
    seen.add(step)
    func(step)
    if (step._nextStep) visitStepRecursive(step._nextStep as T, func, seen)
    if (step.branches) {
        for (const branch of Object.values(step.branches)) if (branch) visitStepRecursive(branch as T, func, seen)
    }
}

export function getInstFromInstPlayerNetid(instPlayerNetid: number | undefined) {
    let inst = ig.mapShared.ccmap.inst
    if (instPlayerNetid !== undefined) {
        const player = ig.game.entitiesByNetid[instPlayerNetid]
        if (player) {
            assert(player instanceof dummy.DummyPlayer)
            const client = player.getClient(true)
            if (client) inst = client.inst
        }
    }
    return inst
}
