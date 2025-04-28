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
