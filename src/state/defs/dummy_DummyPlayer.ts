import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'

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
    return {
        data: this.data,
        pos: this.coll.pos,
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
}

prestart(() => {
    dummy.DummyPlayer.inject({ getState, setState })
    dummy.DummyPlayer.create = (uuid: string, state) => {
        const inputManager = undefined as unknown as dummy.InputManager
        assert(state.data)
        const entity = ig.game.spawnEntity<dummy.DummyPlayer, dummy.DummyPlayer.Settings>(dummy.DummyPlayer, 0, 0, 0, {
            uuid,
            data: state.data,
            inputManager,
        })
        return entity
    }
}, 2)
