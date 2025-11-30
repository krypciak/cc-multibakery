import { assert } from '../../misc/assert'
import type { PhysicsServer } from './physics-server'

export function isPhysics(server: typeof multi.server): server is PhysicsServer {
    return server && server.physics
}
export function assertPhysics(server: typeof multi.server): asserts server is PhysicsServer {
    assert(server?.physics)
}
