import { postload } from '../plugin'
import { assert } from '../misc/assert'

postload(() => {
    ig.module('multibakery.step.id')
    ig._loadQueue.unshift(ig._loadQueue.pop()!)
    ig.requires('impact.base.steps').defines(injectSteps)
})

type Entry = { step: ig.StepBase; settings: ig.ActionStepBase.Settings | ig.EventStepBase.Settings }
export const stepList: Entry[] = []

declare global {
    namespace ig {
        interface StepBase {
            stepId: number
        }
    }
}
let stepId = 0

function injectSteps() {
    function constructStepsRecursive(
        stepSettingsList: ig.EventStepBase.Settings[] | ig.ActionStepBase.Settings[],
        stepNamespace: typeof ig.EVENT_STEP | typeof ig.ACTION_STEP,
        labeledSteps: Record<string, ig.StepBase>,
        lastLastSteps: ig.StepBase[]
    ): Nullable<ig.StepBase> {
        let rootStep: ig.StepBase | null = null
        let lastSteps: ig.StepBase[] = []

        for (const stepSettings of stepSettingsList) {
            const stepType = stepSettings.type
            // @ts-expect-error
            const stepClass: any = stepNamespace[stepType]

            if (!stepClass) continue

            /* custom stuff start */
            const step: ig.StepBase = new stepClass(stepSettings)
            step.stepId = ++stepId
            stepList.push({ step, settings: stepSettings })
            /* custom stuff end */

            if (stepType == 'LABEL') {
                // @ts-expect-error
                const name: string = step.name
                assert(name)
                assert(!labeledSteps[name], `Step Collection includes label '${name}' twice`)
                labeledSteps[name] = step
            }

            for (const lastStep of lastSteps) lastStep._nextStep = step

            lastSteps = []

            const branchNames = step.getBranchNames?.()
            if (branchNames) {
                step.branches ??= {}
                for (const branchName of branchNames) {
                    const branchSettings = stepSettings[branchName] ?? []
                    step.branches![branchName] = constructStepsRecursive(
                        branchSettings,
                        stepNamespace,
                        labeledSteps,
                        lastSteps
                    )!
                }
            }
            lastSteps.push(step)
            if (!rootStep) rootStep = step
        }

        lastLastSteps.push(...lastSteps)

        return rootStep
    }

    ig.StepHelpers.constructSteps = function (steps, stepNamespace, labeledSteps): ig.StepBase {
        return constructStepsRecursive(steps, stepNamespace, labeledSteps, [])!
    }
}

export function getStepCount(): number {
    return Object.keys(ig.EVENT_STEP).length + Object.keys(ig.ACTION_STEP).length
}
