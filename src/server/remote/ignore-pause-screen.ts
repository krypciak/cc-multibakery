import { assert } from '../../misc/assert'
import { prestart } from '../../loading-stages'
import { PhysicsServer } from '../physics/physics-server'

declare global {
    namespace ig {
        var inPauseScreen: boolean | undefined
    }
}

prestart(() => {
    sc.PauseScreenGui.inject({
        doStateTransition(name, skipTransition, removeAfter, callback, initDelay) {
            this.parent(name, skipTransition, removeAfter, callback, initDelay)

            if (!ig.client) return

            function trySetBlock(value: boolean) {
                if (multi.server instanceof PhysicsServer) {
                    const inp = ig.client!.player?.inputManager
                    if (inp instanceof dummy.input.Puppet.InputManager) {
                        setPauseScreenBlock(inp, value)
                    }
                }
            }

            if (name == 'DEFAULT') {
                ig.inPauseScreen = true
                trySetBlock(true)
            } else if (name == 'HIDDEN') {
                ig.inPauseScreen = false
                trySetBlock(false)
            } else assert(false)
        },
    })
})

export function setPauseScreenBlock(inp: dummy.input.Puppet.InputManager, value: boolean) {
    const id = 'pauseScreen'
    if (value) {
        inp.mainBlock.blockBoth(id)
    } else {
        inp.mainBlock.unblockBoth(id)
    }
}
