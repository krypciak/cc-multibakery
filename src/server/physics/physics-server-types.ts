import { assert } from '../../misc/assert'
import type { NetServerInfoPhysics } from '../../client/menu/server-info-types'
import type { CrosscodeWebModuleOptions } from '../../net/crosscode-web-http-modules'
import type { NetTransportServerSettings } from '../../net/net-transport'
import type { ServerSettings } from '../server-types'
import type { PhysicsServer } from './physics-server'

export function isPhysics(server: typeof multi.server): server is PhysicsServer {
    return server && server.physics
}
export function assertPhysics(server: typeof multi.server): asserts server is PhysicsServer {
    assert(server?.physics)
}

export interface PhysicsServerConnectionSettings {
    httpPort: number
    crosscodeWeb?: CrosscodeWebModuleOptions
    https?: { cert: string; key: string }

    pingInterval?: number
    pingTimeout?: number

    transport: NetTransportServerSettings
}

export interface PhysicsServerSettings extends ServerSettings {
    godmode?: boolean
    netInfo?: NetServerInfoPhysics
    save?: {
        manualSaving?: boolean
        loadFromSlot?: number
        loadSaveData?: ig.SaveSlot.Data
        automaticallySave?: boolean
    }
    disablePlayerIdlePose?: boolean
    copyNewPlayerStats?: boolean

    /* when this is true, forceConsistentTickTimes is forced off */
    useAnimationFrameLoop?: boolean
}
