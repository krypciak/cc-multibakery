import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { RemoteServer } from '../../server/remote-server'

export {}
declare global {
    namespace dummy {
        interface DummyPlayer {
            type: 'dummy.DummyPlayer'
            getState(this: this): Return
            setState(this: this, state: Return): void
        }
        interface DummyPlayerConstructor {
            create(uuid: string, state: Return): dummy.DummyPlayer
        }
    }
}

type Return = Partial<ReturnType<typeof getState>>
function getState(this: dummy.DummyPlayer) {
    // const anim = this.animState.animations[0]
    // console.log(this.currentAnim, anim.sequence.length, )
    return {
        data: this.data,
        pos: this.coll.pos,
        currentAnim: this.currentAnim,
        currentAnimTimer: this.animState.timer,
        face: this.face,
        // input: this.input.getInput(),
        // gamepadInput: this.gamepadManager.getInput(),
        // gatherInput: this.nextGatherInput,
        // element: this.model.currentElementMode,
        // relativeCursorPos: this.crosshairController.relativeCursorPos,
    }
}
function setState(this: dummy.DummyPlayer, state: Return) {
    if (state.data) this.data = state.data
    if (state.pos) {
        const p1 = this.coll.pos
        const p2 = state.pos
        if (!Vec3.equal(p1, p2)) {
            this.setPos(state.pos.x, state.pos.y, state.pos.z, /* fix weird animation glitches */ p1.z == p2.z)
        }
    }
    if (state.currentAnim) {
        this.currentAnim = state.currentAnim
        // this.setCurrentAnim(state.currentAnim)
    }
    if (state.currentAnimTimer) {
        this.animState.timer = state.currentAnimTimer
    }
    if (state.face) {
        this.face = state.face
    }
    // if (state.input) {
    //     this.input.setInput(state.input)
    // }
    // if (state.gamepadInput) {
    //     this.gamepadManager.setInput(state.gamepadInput)
    // }
    // if (state.gatherInput) {
    //     this.nextGatherInput = state.gatherInput
    // }
    // if (state.relativeCursorPos && this.crosshairController) {
    //     this.crosshairController.relativeCursorPos = state.relativeCursorPos
    // }
    // if (state.element && this.model.currentElementMode !== state.element) {
    //     this.model.setElementMode(state.element, false, false)
    // }

    this.updateAnim()
    // {
    //     const backup = ig.ActorEntity.prototype.update
    //     ig.ActorEntity.prototype.update = () => {}
    //     sc.ActorEntity.prototype.update.call(this)
    //     ig.ActorEntity.prototype.update = backup
    // }
}

prestart(() => {
    dummy.DummyPlayer.inject({ getState, setState })
    dummy.DummyPlayer.create = (uuid: string, state) => {
        const inputManager = new dummy.input.Puppet.InputManager()
        assert(state.data)
        const entity = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            uuid,
            data: state.data,
            inputManager,
        })
        return entity
    }

    dummy.DummyPlayer.inject({
        update() {
            if (!(multi.server instanceof RemoteServer)) return this.parent()
            if (!ig.settingState) return

            this.parent()
        },
    })
}, 2)
