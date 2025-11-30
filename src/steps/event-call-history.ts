import { prestart } from '../loading-stages'
import { isRemote } from '../server/remote/is-remote-server'
import { onEventStepStart } from '../state/event-steps'

declare global {
    namespace ig {
        interface EventCall {
            event: ig.Event
        }
    }
}

prestart(() => {
    ig.EventCall.inject({
        init(event, input, runType, onStart, onEnd, callEntity, data) {
            this.parent(event, input, runType, onStart, onEnd, callEntity, data)
            this.event = event
        },
        performStep(stackEntry) {
            if (isRemote(multi.server)) return this.parent(stackEntry)

            do {
                if (!stackEntry.currentStep) stackEntry.currentStep = stackEntry.event.rootStep
                const step = stackEntry.currentStep
                if (!step) break

                step.start?.(stackEntry.stepData, this)

                onEventStepStart(this, step, stackEntry.stepData)

                if (step.getInlineEvent) {
                    const inlineEvent = step.getInlineEvent()
                    stackEntry = this.callInlineEvent(inlineEvent, step.getInlineEventInput!() as any)
                    ig.vars.setupCallScope(stackEntry.vars)
                }
            } while (!stackEntry.currentStep)
            return stackEntry
        },
    })
})
