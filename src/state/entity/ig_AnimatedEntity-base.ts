import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { isPhysics } from '../../server/physics/is-physics-server'
import type { StateMemory } from '../state-util'
import { undefinedIfFalsy } from '../state-util'

type Return = ReturnType<typeof getEntityState>
export function getEntityState(this: ig.AnimatedEntity, memory: StateMemory) {
    return {
        pos: memory.diffVec3(this.coll.pos),
        baseZPos: memory.diff(this.coll.baseZPos),
        hidden: memory.diff(this._hidden),
        currentAnim: memory.diff(typeof this.currentAnim === 'string' ? this.currentAnim : undefined),
        currentAnimTimer: memory.onlyOnce(this.animState.timer),
        resetAnimTimer: undefinedIfFalsy(this.animState.timer - ig.system.tick == 0),
        externAnimSheetPath: memory.diff(this.externAnimSheetPath),
        externAnimSheetName: memory.diff(this.externAnimSheetName),

        accelDir: memory.diffVec2(this.coll.accelDir),
        animAlpha: memory.diff(this.animState.alpha),
    }
}

export function setEntityState(this: ig.AnimatedEntity, state: Return) {
    if (state.pos) {
        this.setPos(state.pos.x, state.pos.y, state.pos.z)
    }
    if (state.baseZPos !== undefined) this.coll.baseZPos = state.baseZPos

    if (state.currentAnim !== undefined) {
        this.currentAnim = state.currentAnim
    } else if (state.externAnimSheetPath) {
        const animName = state.externAnimSheetName
        assert(animName)
        const animSheet = new ig.AnimationSheet(state.externAnimSheetPath)
        const replacedAnimSheet = sc.playerSkins.replaceAnim(animSheet)
        this.setCurrentAnim(
            replacedAnimSheet.anims[animName],
            true,
            /* e && e.anims[this.followUpName] */ undefined,
            true
        )
    }

    if (state.hidden !== undefined && this._hidden !== state.hidden) {
        if (state.hidden) {
            this.hide()
        } else {
            this.show()
        }
    }

    if (state.accelDir) this.coll.accelDir = state.accelDir
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
