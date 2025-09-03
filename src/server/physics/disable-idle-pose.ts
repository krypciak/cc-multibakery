import { prestart } from '../../loading-stages'
import { PhysicsServer } from './physics-server'

prestart(() => {
    dummy.DummyPlayer.inject({
        initIdleActions() {
            if (multi.server instanceof PhysicsServer && multi.server.settings.disablePlayerIdlePose) {
                if (this.idle?.actions) {
                    this.idle.actions = []
                }
                return
            }
            return this.parent()
        },
    })
})
