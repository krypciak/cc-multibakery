import { prestart } from '../../loading-stages'
import { isPhysics } from './physics-server-types'

prestart(() => {
    dummy.DummyPlayer.inject({
        initIdleActions() {
            if (isPhysics(multi.server) && multi.server.settings.disablePlayerIdlePose) {
                if (this.idle?.actions) {
                    this.idle.actions = []
                }
                return
            }
            return this.parent()
        },
    })
})
