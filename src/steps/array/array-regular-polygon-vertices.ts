import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'

declare global {
    namespace ig {
        namespace EVENT_STEP {
            namespace SET_ARRAY_REGULAR_POLYGON_VERTICES {
                interface Settings {
                    varName: ig.Event.VariableExpression
                    size: ig.Event.NumberExpression
                    radius: ig.Event.NumberExpression
                    rotation?: ig.Event.NumberExpression
                }
            }
            interface SET_ARRAY_REGULAR_POLYGON_VERTICES extends ig.EventStepBase {
                varName: ig.Event.VariableExpression
                size: ig.Event.NumberExpression
                radius: ig.Event.NumberExpression
                rotation: ig.Event.NumberExpression
            }
            interface SET_ARRAY_REGULAR_POLYGON_VERTICES_CONSTRUCTOR
                extends ImpactClass<SET_ARRAY_REGULAR_POLYGON_VERTICES> {
                new (
                    settings: ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES.Settings
                ): SET_ARRAY_REGULAR_POLYGON_VERTICES
            }
            var SET_ARRAY_REGULAR_POLYGON_VERTICES: SET_ARRAY_REGULAR_POLYGON_VERTICES_CONSTRUCTOR
        }
    }
}

function polygonVertices(n: number, radius = 1, rotationRad = 0) {
    const vertices: Vec2[] = []
    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + rotationRad
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        vertices.push({ x, y })
    }
    return vertices
}

prestart(() => {
    ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES = ig.EventStepBase.extend({
        init(settings) {
            this.varName = settings.varName
            this.size = settings.size
            this.radius = settings.radius
            this.rotation = settings.rotation ?? 0
            assert(this.varName, `ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES "varName" missing!`)
            assert(this.size, `ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES "size" missing!`)
            assert(this.radius, `ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES "radius" missing!`)
        },
        start() {
            const varName = ig.Event.getVarName(this.varName)
            assert(varName, 'ig.EVENT_STEP.SET_ARRAY_REGULAR_POLYGON_VERTICES "varName" is null!')

            const n = ig.Event.getExpressionValue(this.size)
            const radius = ig.Event.getExpressionValue(this.radius)
            const rotation = ig.Event.getExpressionValue(this.rotation)

            const verts: Vec3[] = polygonVertices(n, radius, (rotation * Math.PI) / 180).map(vec2 => ({
                ...vec2,
                z: 0,
            }))

            ig.vars.set(varName, verts)
        },
    })
})
