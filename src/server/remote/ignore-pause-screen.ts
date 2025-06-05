import { assert } from '../../misc/assert'
import { prestart } from '../../plugin'
import { PhysicsServer } from '../physics/physics-server'
import { RemoteServer } from './remote-server'

declare global {
    namespace ig {
        var justExitedPauseScreen: boolean | undefined
    }
}

prestart(() => {
    sc.PauseScreenGui.inject({
        doStateTransition(name, skipTransition, removeAfter, callback, initDelay) {
            this.parent(name, skipTransition, removeAfter, callback, initDelay)

            if (!ig.client) return

            if (name == 'DEFAULT') {
                if (multi.server instanceof PhysicsServer) {
                    const inp = ig.client.player.inputManager
                    if (inp instanceof dummy.input.Puppet.InputManager) {
                        setPauseScreenBlock(inp, true)
                    }
                }
            } else if (name == 'HIDDEN') {
                if (multi.server instanceof RemoteServer) {
                    ig.justExitedPauseScreen = true
                }
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
