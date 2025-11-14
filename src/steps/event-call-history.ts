import { prestart } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import { onEventStepStart } from '../state/event-steps'

prestart(() => {
    ig.EventCall.inject({
        performStep(stackEntry) {
            if (!(multi.server instanceof PhysicsServer)) return this.parent(stackEntry)

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
