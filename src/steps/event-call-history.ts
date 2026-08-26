import { prestart } from '../loading-stages'
import { isRemote } from '../server/remote/remote-server-types'

type Listener = (eventCall: ig.EventCall, step: ig.EventStepBase) => void
const eventStepStartListeners: Listener[] = []
export function addEventStepStartListener(listener: Listener) {
    eventStepStartListeners.push(listener)
}

prestart(() => {
    if (!PHYSICS) return

    ig.EventCall.inject({
        performStep(stackEntry) {
            if (isRemote(multi.server)) return this.parent(stackEntry)

            do {
                if (!stackEntry.currentStep) stackEntry.currentStep = stackEntry.event.rootStep
                const step = stackEntry.currentStep
                if (!step) break

                step.start?.(stackEntry.stepData, this)

                for (const listener of eventStepStartListeners) listener(this, step)

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
