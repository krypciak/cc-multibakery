import { assert } from '../../misc/assert'
import type { RemoteServer } from './remote-server'

export function isRemote(server: typeof multi.server): server is RemoteServer {
    return server && !server.physics
}
export function assertRemote(server: typeof multi.server): asserts server is RemoteServer {
    assert(!server?.physics)
}
