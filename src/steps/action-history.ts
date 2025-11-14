import { prestart } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import { onActionStepStart } from '../state/action-steps'

prestart(() => {
    function startStep(step: ig.ActionStepBase, actor: ig.ActorEntity) {
        step.start(actor)
        onActionStepStart(step, actor)
    }
    ig.Action.inject({
        run(actor) {
            if (!(multi.server instanceof PhysicsServer)) return this.parent(actor)

            if (!this.parallelMove) Vec2.assignC(actor.coll.accelDir, 0, 0)
            const oldCurrentAction = actor.currentAction

            let step = actor.currentActionStep
            if (!step) {
                step = this.rootStep
                if (!step) return true
                if (actor.stepTimer > 0) actor.stepTimer = 0
                startStep(step, actor)
                if (oldCurrentAction != actor.currentAction) return false
                actor.currentActionStep = step
            }

            for (let callLimit = 1e4; step?.run(actor); ) {
                if (actor.stepTimer > 0) actor.stepTimer = 0
                if (!actor.currentAction) {
                    step = null
                    break
                }
                if (oldCurrentAction != actor.currentAction || step != actor.currentActionStep) return false
                let nextStep: ig.ActionStepBase | null = null
                if (step.getJumpLabelName) {
                    // const f = a.getJumpLabelName(actor)
                    const labelName = step.getJumpLabelName()
                    if (labelName) {
                        nextStep = this.labeledSteps[labelName]
                        if (!nextStep) throw new Error(`Label '${labelName}' not found.`)
                    }
                }
                nextStep ??= step.getNext(actor)
                step = nextStep

                if (--callLimit <= 0) {
                    throw new Error(
                        `Ridiculous number of steps execute in one action tick!! Infinite Loop?` +
                            `Action Name: ${this.name}, Entity Group: ${'group' in actor ? actor.group : undefined},` +
                            ` Entity Name: ${actor.name}, Enemy Name: ${'enemyName' in actor ? actor.enemyName : undefined}`
                    )
                }
                actor.currentActionStep = step
                if (step) startStep(step, actor)

                if (oldCurrentAction != actor.currentAction || step != actor.currentActionStep) return false
            }
            actor.currentActionStep = step
            actor.stepTimer = actor.stepTimer < 0 ? 0 : actor.stepTimer - actor.coll.getTick(true)
            let ret = !step && !this.repeating
            if (ret && !this.parallelMove) Vec2.assignC(actor.coll.accelDir, 0, 0)
            return ret
        },
    })
})
