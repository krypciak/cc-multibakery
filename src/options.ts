import type { Options } from 'ccmodmanager/types/mod-options'
import Multibakery, { poststart, prestart } from './plugin'
import { RemoteServer } from './server/remote/remote-server'
import { DEFAULT_HTTP_PORT } from './net/web-server'
import { generateRandomUsername, isUsernameValid } from './misc/username-util'

export let Opts: ReturnType<typeof modmanager.registerAndGetModOptions<ReturnType<typeof registerOpts>>>

const defaultClientUsername = '@DEFAULT_USERNAME'

function registerOpts() {
    const opts = {
        client: {
            settings: {
                title: 'Client',
                tabIcon: 'general',
            },
            headers: {
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
                    showPacketNetworkTraffic: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Show network traffic',
                        description: 'Shows the network trafic per second',
                        changeEvent() {
                            if (multi.server instanceof RemoteServer) {
                                multi.server.measureTraffic =
                                    Opts.showPacketNetworkTraffic || Opts.showPacketNetworkSize
                            }
                        },
                    },
                    showPacketNetworkSize: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Show individual traffic',
                        description: 'Shows the size of individual packets',
                        changeEvent() {
                            if (multi.server instanceof RemoteServer) {
                                multi.server.measureTraffic =
                                    Opts.showPacketNetworkTraffic || Opts.showPacketNetworkSize
                            }
                        },
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
                        init: defaultClientUsername,
                        changeEvent() {
                            if (Opts.clientLogin == defaultClientUsername) {
                                Opts.clientLogin = generateRandomUsername()
                            }
                        },
                        isValid: isUsernameValid,
                    },
                },
            },
        },
        server: {
            settings: {
                title: 'Server',
                tabIcon: 'gamepad',
            },
            headers: {
                general: {
                    serverEnableNet: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Enable networking',
                        description: 'Share server to LAN',
                        changeEvent() {},
                        updateMenuOnChange: true,
                    },
                    serverHttpPortInfo: {
                        type: 'INFO',
                        name: 'Server port (1025 - 65535)',
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                    serverHttpPort: {
                        type: 'INPUT_FIELD',
                        init: `${DEFAULT_HTTP_PORT}`,
                        description: 'Server port (1025 - 65535)',
                        isValid(text) {
                            const port = Number(text)
                            if (Number.isNaN(port)) return false
                            if (port > 65535 || port <= 0) return false
                            if (port < 1024) return false
                            return true
                        },
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                    serverTitleInfo: {
                        type: 'INFO',
                        name: 'Server title',
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                    serverTitle: {
                        type: 'INPUT_FIELD',
                        init: `my server`,
                        description: 'Server title',
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                    serverDescriptionInfo: {
                        type: 'INFO',
                        name: 'Server description',
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                    serverDescription: {
                        type: 'INPUT_FIELD',
                        init: `hello!`,
                        description: 'Server description',
                        hidden: (): boolean => !Opts.serverEnableNet,
                    },
                },
                advanced: {
                    serverGodmode: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Godmode',
                        description: 'Set all player stats to max',
                    },
                    serverDisplayServerInstance: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display server inst',
                    },
                    serverDisplayMaps: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display map insts',
                    },
                    serverDisplayClientInstances: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Display client insts',
                    },
                    serverDisplayRemoteClientInstances: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display remote client insts',
                    },
                    serverForceConsistentTickTimes: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Force consistent tick times',
                    },
                    serverGlobalTps: {
                        type: 'OBJECT_SLIDER',
                        init: 60,
                        min: 60,
                        max: 240,
                        step: 1,
                        name: 'TPS',
                        customNumberDisplay(index) {
                            return index + 60
                        },
                    },
                    physicsAttemptCrashRecovery: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Attempt crash recovery',
                        description: '',
                    },
                },
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

prestart(() => {
    registerOpts()
}, 0)

poststart(() => {
    if (Opts.clientLogin == defaultClientUsername) {
        Opts.clientLogin = defaultClientUsername
    }
})
