import { RemoteServerConnectionSettings } from '../../server/remote/remote-server'
import { DEFAULT_HTTP_PORT } from '../../net/web-server'
import { PhysicsServerConnectionSettings } from '../../server/physics/physics-server'

interface ServerDetailsBase {
    title: string
    description: string
}
export interface ServerDetailsRemote extends ServerDetailsBase {
    multibakeryVersion: string
    hasIcon?: boolean
    globalTps: number
}

export interface NetServerInfoRemote {
    connection: RemoteServerConnectionSettings
    details?: ServerDetailsRemote
}

export interface ServerDetailsPhysics extends ServerDetailsBase {
    iconPath?: string
}

export interface NetServerInfoPhysics {
    connection: PhysicsServerConnectionSettings
    details: ServerDetailsPhysics
}

export function getServerListInfo(): NetServerInfoRemote[] {
    return [
        {
            connection: {
                type: 'socket',
                host: '127.0.0.1',
                port: DEFAULT_HTTP_PORT,
            },
        },
        {
            connection: {
                type: 'socket',
                host: 's.ogur.pl',
                port: DEFAULT_HTTP_PORT,
            },
        },
    ]
}
