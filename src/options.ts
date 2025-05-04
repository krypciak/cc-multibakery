import type { Options } from 'ccmodmanager/types/mod-options'
import Multibakery from './plugin'

export let Opts: ReturnType<typeof modmanager.registerAndGetModOptions<ReturnType<typeof registerOpts>>>

export function registerOpts() {
    const opts = {
        general: {
            settings: {
                title: 'General',
                tabIcon: 'general',
            },
            headers: {
                server: {},
                client: {
                    hideClientUsername: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Hide your username',
                        description: 'Hides your player username',
                    },
                    showClientMsPing: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Show ping',
                        description: 'Show client ping in miliseconds',
                    },
                    showClientConnectionInfo: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Show connection info',
                        description: 'Show client connection info',
                    },
                },
            },
        },
        account: {
            settings: {
                title: 'Account',
                tabIcon: 'interface',
            },
            headers: {
                account: {
                    info: {
                        type: 'INFO',
                        name: 'Username',
                    },
                    clientLogin: {
                        type: 'INPUT_FIELD',
                        init: `client${(100 + 900 * Math.randomOrig()).floor()}`,
                        description: 'desc!',
                        changeEvent() {},
                    },
                },
                server: {},
            },
        },
    } as const satisfies Options

    Opts = modmanager.registerAndGetModOptions(
        {
            modId: Multibakery.manifset.id,
            title: Multibakery.manifset.title,
        },
        opts
    )
    return opts
}
