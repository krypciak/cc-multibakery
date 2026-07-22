import { prestart } from '../../loading-stages'
import { assert } from '../../misc/assert'
import { PhysicsServer } from './physics-server'
import type { PhysicsServerSettings } from './physics-server-types'

declare global {
    namespace multi {
        function createPhysicsServer(settings: PhysicsServerSettings): PhysicsServer
    }
}
prestart(() => {
    multi.createPhysicsServer = function (settings) {
        assert(PHYSICS)
        return PHYSICS && new PhysicsServer(settings)
    }
})
