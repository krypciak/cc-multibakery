import { prestart } from '../loading-stages'
import { assert } from '../misc/assert'

declare global {
    namespace ig.EVENT_STEP {
        namespace RUN_JS_FUNCTION {
            interface Settings {
                func: (eventCall?: ig.EventCall) => Promise<void> | void
            }
            interface Data {
                finished: boolean
            }
        }
        interface RUN_JS_FUNCTION extends ig.EventStepBase {
            func: (eventCall?: ig.EventCall) => Promise<void> | void

            start(this: this, data: ig.EVENT_STEP.RUN_JS_FUNCTION.Data, eventCall?: ig.EventCall): void
            run(this: this, data: ig.EVENT_STEP.RUN_JS_FUNCTION.Data): boolean
        }
        interface RUN_JS_FUNCTION_CONSTRUCTOR extends ImpactClass<RUN_JS_FUNCTION> {
            new (settings: ig.EVENT_STEP.RUN_JS_FUNCTION.Settings): RUN_JS_FUNCTION
        }
        var RUN_JS_FUNCTION: RUN_JS_FUNCTION_CONSTRUCTOR
    }
}
prestart(() => {
    ig.EVENT_STEP.RUN_JS_FUNCTION = ig.EventStepBase.extend({
        init(settings) {
            this.func = settings.func
            if (typeof this.func == 'string') {
                this.func = new Function(this.func) as any
            }
            assert(this.func, 'ig.EVENT_STEP.RUN_JS_FUNCTION "func" missing!')
        },
        start(data, eventCall) {
            data.finished = false
            ;(async () => {
                await this.func(eventCall)
                data.finished = true
            })()
        },
        run(data) {
            return data.finished
        },
    })
})
