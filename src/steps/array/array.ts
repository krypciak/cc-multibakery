import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'

import './array-entity-var-access'

declare global {
    namespace ig {
        // @ts-expect-error
        type VarValue = any

        namespace Event {
            interface VarObject {
                index?: ig.Event.NumberExpression
            }
            type ArrayExpression<T = ig.VarValue> = ig.Event.VarExpression<T[]>
        }
        interface EventConstructor {
            getArray<T>(array: ig.Event.ArrayExpression<T>): T[]
        }
    }
}

interface StoredArray<T = ig.VarValue> extends Array<T> {}

prestart(() => {
    ig.Event.getArray = array => {
        let value = ig.Event.getExpressionValue(array) as StoredArray
        assert(Array.isArray(value), `ig.Event.getArray: resolved "${JSON.stringify(array)}" is not an array!`)
        value = value.map(v => ig.Event.getExpressionValue(v))
        return value
    }
    const orig = ig.Event.getExpressionValue
    ig.Event.getExpressionValue = expr => {
        if (expr && typeof expr === 'object' && 'index' in expr) {
            const value = orig(expr)
            assert(Array.isArray(value), `${JSON.stringify(expr)} received value is not an array!`)
            const index = ig.Event.getExpressionValue(expr.index as ig.Event.NumberExpression)
            return value[index]
        }
        return orig(expr)
    }
})

declare global {
    namespace ig {
        namespace EVENT_STEP {
            namespace CHANGE_VAR_ARRAY {
                type ArrayOperation = 'set' | 'push' | 'erase' | 'intersect' | 'filterUnique'
                interface Settings {
                    changeType: ig.EVENT_STEP.CHANGE_VAR_ARRAY.ArrayOperation
                    varName: ig.Event.VariableExpression
                    value?: ig.Event.ArrayExpression
                }
            }
            interface CHANGE_VAR_ARRAY extends ig.EventStepBase {
                changeType: ig.EVENT_STEP.CHANGE_VAR_ARRAY.ArrayOperation
                varName: ig.Event.VariableExpression
                value?: ig.Event.ArrayExpression
            }
            interface CHANGE_VAR_ARRAY_CONSTRUCTOR extends ImpactClass<CHANGE_VAR_ARRAY> {
                new (settings: ig.EVENT_STEP.CHANGE_VAR_ARRAY.Settings): CHANGE_VAR_ARRAY
            }
            var CHANGE_VAR_ARRAY: CHANGE_VAR_ARRAY_CONSTRUCTOR
        }
    }
}

export function arrayVarAccess<T>(array: T[], keys: string[]) {
    if (keys.length == 0) return array
    if (keys[0] == 'length') return array.length
    const index = parseInt(keys[0])
    const value = array[index]
    if (value instanceof ig.Entity) return ig.vars.forwardEntityVarAccess(value, keys, 1)
    return value
}

function setArray<T>(array: T[], to: T[]) {
    array.length = to.length
    for (let i = 0; i < to.length; i++) array[i] = to[i]
}

prestart(() => {
    ig.EVENT_STEP.CHANGE_VAR_ARRAY = ig.EventStepBase.extend({
        init(settings) {
            this.changeType = settings.changeType
            this.varName = settings.varName
            this.value = settings.value
            assert(this.changeType, `ig.EVENT_STEP.CHANGE_VAR_ARRAY "operation" missing!`)
            assert(this.varName, `ig.EVENT_STEP.CHANGE_VAR_ARRAY "varName" missing!`)
        },
        start() {
            const varName = ig.Event.getVarName(this.varName)
            assert(varName, 'ig.EVENT_STEP.CHANGE_VAR_ARRAY "varName" is null!')

            const getArray = () => {
                assert(this.value, `ig.EVENT_STEP.CHANGE_VAR_ARRAY "value" missing!`)
                return ig.Event.getArray(this.value)
            }

            if (this.changeType == 'set') {
                const array = getArray()
                ig.vars.set(varName, array)
                return
            }

            const baseArray = ig.vars.get(varName)
            assert(Array.isArray(baseArray), 'ig.EVENT_STEP.CHANGE_VAR_ARRAY "varName" is not an array!')

            if (this.changeType == 'filterUnique') {
                setArray(baseArray, [...new Set(baseArray)])
                return
            }

            const array = getArray()

            if (this.changeType == 'push') {
                baseArray.push(...array)
            } else if (this.changeType == 'erase') {
                for (const value of array) {
                    baseArray.erase(value)
                }
            } else if (this.changeType == 'intersect') {
                const intersection = baseArray.filter(x => array.includes(x))
                setArray(baseArray, intersection)
            } else assert(false, `ig.EVENT_STEP.CHANGE_VAR_ARRAY invalid operation: "${this.changeType}"`)
        },
    })
})
