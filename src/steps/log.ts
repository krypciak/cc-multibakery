import { prestart } from '../loading-stages'

declare global {
    namespace ig.EVENT_STEP {
        namespace LOG {
            interface Settings {
                text: ig.Event.StringExpression
            }
        }
        interface LOG extends ig.EventStepBase {
            text: ig.Event.StringExpression
        }
        interface LOG_CONSTRUCTOR extends ImpactClass<LOG> {
            new (settings: ig.EVENT_STEP.LOG.Settings): LOG
        }
        var LOG: LOG_CONSTRUCTOR
    }
}
prestart(() => {
    ig.EVENT_STEP.LOG = ig.EventStepBase.extend({
        init(settings) {
            this.text = settings.text
        },
        start() {
            const text = ig.Event.getExpressionValue(this.text)
            console.log(text)
        },
    })
})
