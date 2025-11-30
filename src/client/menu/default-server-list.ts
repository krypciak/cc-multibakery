import type { NetServerInfoRemote } from './server-info'

export const DEFAULT_HTTP_PORT = 33405

export const serverListDefault: NetServerInfoRemote[] = [
    {
        connection: {
            type: 'socket',
            host: 'crosscode.krypek.cc',
            port: 443,
        },
    },
    {
        connection: {
            type: 'socket',
            host: '127.0.0.1',
            port: DEFAULT_HTTP_PORT,
        },
    },
]
