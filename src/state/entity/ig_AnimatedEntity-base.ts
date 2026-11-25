import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { isPhysics } from '../../server/physics/physics-server-types'
import type { StateMemory } from '../state-util'
import { undefinedIfFalsy } from '../state-util'
import * as igEntity from './ig_Entity-base'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.AnimatedEntity, memory: StateMemory) {
    return {
        ...igEntity.getEntityState.call(this, memory),
        currentAnim: memory.diff(typeof this.currentAnim === 'string' ? this.currentAnim : undefined),
        currentAnimTimer: memory.onlyOnce(this.animState.timer),
        resetAnimTimer: undefinedIfFalsy(this.animState.timer - ig.system.tick == 0),
        externAnimSheetPath: memory.diff(this.externAnimSheetPath),
        externAnimSheetName: memory.diff(this.externAnimSheetName),

        animAlpha: memory.diff(this.animState.alpha),
    }
}

export function setEntityState(this: ig.AnimatedEntity, state: Return) {
    igEntity.setEntityState.call(this, state)

    if (state.currentAnim !== undefined) {
        this.currentAnim = state.currentAnim
    } else if (state.externAnimSheetPath) {
        const animName = state.externAnimSheetName
        assert(animName)

        let anim: ig.MultiDirAnimationSet | ig.SingleDirAnimationSet | undefined
        /* fix from xenons-playable-classes js/azure-lazuline/extern-anim-fix.js */
        if (this.name != 'Lea' && this.name != 'Shizuka0') {
            const animSheet = this.animSheet
            anim = animSheet.anims[animName]
        }
        if (!anim) {
            let animSheet = new ig.AnimationSheet(state.externAnimSheetPath)
            animSheet = sc.playerSkins.replaceAnim(animSheet)
            anim = animSheet.anims[animName]
        }

        this.setCurrentAnim(anim, true, /* e && e.anims[this.followUpName] */ undefined, true)
    }

    if (state.animAlpha !== undefined) this.animState.alpha = state.animAlpha

    if (state.resetAnimTimer) this.animState.timer = 0
    this.updateAnim()
    if (state.currentAnimTimer !== undefined) this.animState.timer = state.currentAnimTimer
}

declare global {
    namespace ig {
        interface AnimatedEntity {
            externAnimSheetPath?: string
            externAnimSheetName?: string
        }
    }
}

prestart(() => {
    ig.AnimatedEntity.inject({
        externAnimSheetName: '',
        externAnimSheetPath: '',
        setCurrentAnim(...args) {
            this.parent(...args)
            this.externAnimSheetName = ''
            this.externAnimSheetPath = ''
        },
    })
    /* inject into player seperately because xenon-playable-classes injects into ig.ENTITY.Player first so ig.AnimatedEntity inject gets skipped */
    ig.ENTITY.Player.inject({
        setCurrentAnim(...args) {
            this.parent(...args)
            this.externAnimSheetName = ''
            this.externAnimSheetPath = ''
        },
    })

    ig.ACTION_STEP.SHOW_EXTERN_ANIM.inject({
        start(target) {
            this.parent(target)

            if (!isPhysics(multi.server)) return

            assert(this.animSheet.path)
            target.externAnimSheetPath = this.animSheet.path
            target.externAnimSheetName = this.animName
        },
    })
    ig.EVENT_STEP.SHOW_EXTERN_ANIM.inject({
        start(data, eventCall) {
            this.parent(data, eventCall)

            if (!isPhysics(multi.server)) return
            const target = ig.Event.getEntity(this.entity, eventCall)
            if (!target) return
            assert(target instanceof ig.AnimatedEntity)

            assert(this.animSheet.path)
            target.externAnimSheetPath = this.animSheet.path
            target.externAnimSheetName = this.animName
        },
    })
})
