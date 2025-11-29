import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'

declare global {
    namespace ig.EVENT_STEP {
        namespace ASSIGN_VEC2 {
            interface Settings {
                varName: ig.Event.VariableExpression
                value: ig.Event.Vec2Expression
            }
        }
        interface ASSIGN_VEC2 extends ig.EventStepBase {
            varName: ig.Event.VariableExpression
            value: ig.Event.Vec2Expression
        }
        interface ASSIGN_VEC2_CONSTRUCTOR extends ImpactClass<ASSIGN_VEC2> {
            new (settings: ig.EVENT_STEP.ASSIGN_VEC2.Settings): ASSIGN_VEC2
        }
        var ASSIGN_VEC2: ASSIGN_VEC2_CONSTRUCTOR
    }
}
prestart(() => {
    ig.EVENT_STEP.ASSIGN_VEC2 = ig.EventStepBase.extend({
        init(settings) {
            this.varName = settings.varName
            this.value = settings.value
            assert(this.varName, 'ig.EVENT_STEP.ASSIGN_VEC2 "varName" is missing!')
            assert(this.value, 'ig.EVENT_STEP.ASSIGN_VEC2 "value" is missing!')
        },
        start() {
            const varName = ig.Event.getVarName(this.varName)
            assert(varName, 'ig.EVENT_STEP.ASSIGN_VEC2 "varName" is null!')

            const value = ig.Event.getVec2(this.value, Vec2.create())

            ig.vars.set(`${varName}.x`, value.x)
            ig.vars.set(`${varName}.y`, value.y)
        },
    })
})

declare global {
    namespace ig.EVENT_STEP {
        namespace ASSIGN_VEC3 {
            interface Settings {
                varName: ig.Event.VariableExpression
                value: ig.Event.Vec3Expression
            }
        }
        interface ASSIGN_VEC3 extends ig.EventStepBase {
            varName: ig.Event.VariableExpression
            value: ig.Event.Vec3Expression
        }
        interface ASSIGN_VEC3_CONSTRUCTOR extends ImpactClass<ASSIGN_VEC3> {
            new (settings: ig.EVENT_STEP.ASSIGN_VEC3.Settings): ASSIGN_VEC3
        }
        var ASSIGN_VEC3: ASSIGN_VEC3_CONSTRUCTOR
    }
}
prestart(() => {
    ig.EVENT_STEP.ASSIGN_VEC3 = ig.EventStepBase.extend({
        init(settings) {
            this.varName = settings.varName
            this.value = settings.value
            assert(this.varName, 'ig.EVENT_STEP.ASSIGN_VEC3 "varName" is missing!')
            assert(this.value, 'ig.EVENT_STEP.ASSIGN_VEC3 "value" is missing!')
        },
        start() {
            const varName = ig.Event.getVarName(this.varName)
            assert(varName, 'ig.EVENT_STEP.ASSIGN_VEC3 "varName" is null!')

            const value = ig.Event.getVec3(this.value, Vec3.create())

            ig.vars.set(`${varName}.x`, value.x)
            ig.vars.set(`${varName}.y`, value.y)
            ig.vars.set(`${varName}.z`, value.z)
        },
    })
})
