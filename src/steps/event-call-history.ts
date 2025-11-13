import { prestart } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import { onStepHistoryAdd } from '../state/steps'

prestart(() => {
    ig.EventCall.inject({
        performStep(stackEntry) {
            if (!(multi.server instanceof PhysicsServer)) return this.parent(stackEntry)

            do {
                if (!stackEntry.currentStep) stackEntry.currentStep = stackEntry.event.rootStep
                const step = stackEntry.currentStep
                if (!step) break

                step.start?.(stackEntry.stepData, this)

                onEventStart.call(this, step, stackEntry.stepData)

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

export let stepWhitelist: Set<number>
prestart(() => {
    stepWhitelist = new Set(
        [
            //
            ig.EVENT_STEP.ADD_MSG_PERSON,
            ig.EVENT_STEP.SHOW_MSG,
            ig.EVENT_STEP.CLEAR_MSG,
            ig.EVENT_STEP.SHOW_SIDE_MSG,
            ig.EVENT_STEP.SHOW_BOARD_MSG,
            ig.EVENT_STEP.SHOW_CHOICE,

            ig.EVENT_STEP.START_NPC_TRADE_MENU,

            ig.EVENT_STEP.SHOW_INPUT_DIALOG,
        ].map(clazz => clazz.classId)
    )
}, 2000)

export interface StepHistoryEntry {
    step: ig.EventStepBase
    data: Record<string, unknown>
    call: ig.EventCall
}

declare global {
    namespace ig {
        interface EventCall {
            whitelistStepHistory?: StepHistoryEntry[]
        }
    }
}

function onEventStart(this: ig.EventCall, step: ig.EventStepBase, data: Record<string, unknown>) {
    // if (fcn(step) != 'ig.EVENT_STEP.CHANGE_VAR_BOOL') {
    //     console.log(
    //         'event on',
    //         instanceinator.id,
    //         'stepId:',
    //         step.stepId,
    //         'type:',
    //         fcn(step),
    //         'data:',
    //         data,
    //         'stepSettings:',
    //         stepList[step.stepId].settings
    //     )
    // }

    if (!stepWhitelist.has(step.classId)) return

    this.whitelistStepHistory ??= []
    const entry: StepHistoryEntry = { step, data, call: this }
    this.whitelistStepHistory.push(entry)

    onStepHistoryAdd(entry)
}
