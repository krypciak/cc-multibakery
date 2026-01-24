import { poststart } from '../loading-stages'
import { isRemote } from '../server/remote/is-remote-server'

declare global {
    namespace ig {
        namespace Input {
            interface KnownActions {
                'nax-art-switch': true
            }
        }
    }
}

poststart(() => {
    if (!REMOTE) return
    if (!activeMods.find(e => e.name === 'nax-art-switch')) return

    sc.GlobalInput.inject({
        onPostUpdate() {
            if (
                isRemote(multi.server) &&
                !ig.game.isControlBlocked() &&
                sc.model.isGame() &&
                !ig.loading &&
                !sc.model.isPaused() &&
                !sc.model.isCutscene() &&
                sc.model.isRunning() &&
                (ig.input.pressed('nax-art-switch') || ig.gamepad.isButtonPressed(ig.BUTTONS.LEFT_STICK))
            ) {
                const orig = ig.game.events.callEvent
                ig.game.events.callEvent = (
                    function (event, ...args) {
                        if (!(event.rootStep instanceof ig.EVENT_STEP.SHOW_EFFECT))
                            return orig.call(this, event, ...args)
                        return
                    } as ig.EventManager['callEvent']
                ).bind(ig.game.events)

                this.parent()

                ig.game.events.callEvent = orig
            } else return this.parent()
        },
    })
})
