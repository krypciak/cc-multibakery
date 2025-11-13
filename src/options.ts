import type { Options } from 'ccmodmanager/types/mod-options'
import { poststart, prestart } from './loading-stages'
import { RemoteServer } from './server/remote/remote-server'
import { DEFAULT_HTTP_PORT } from './net/web-server'
import { generateRandomUsername, isUsernameValid } from './misc/username-util'
import Multibakery from './plugin'
import { serverListDefault } from './client/menu/server-info'
import { PhysicsServer } from './server/physics/physics-server'

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
                    showNwjsVersionProblemsPopup: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Check NW.js version',
                        description: 'Check for problems related to outdated NW.js version',
                    },
                    serverList: {
                        type: 'JSON_DATA',
                        init: serverListDefault,
                    },
                },
                combat: {
                    hideClientPvpHpBar: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Hide your pvp hp bar',
                        description: 'Hide your own pvp hp bar',
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
                    clientLogin: {
                        type: 'INPUT_FIELD',
                        name: 'Username',
                        description: ' ',
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
                networking: {
                    serverNetworkingNotPossible: {
                        type: 'INFO',
                        name: 'Networking not available in this build of multibakery!',
                        hidden: (): boolean => PHYSICSNET,
                    },
                    serverEnableNet: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Enable networking',
                        description: 'Share server to LAN',
                        changeEvent() {},
                        updateMenuOnChange: true,
                        hidden: (): boolean => !PHYSICSNET,
                    },
                    serverHttpPort: {
                        type: 'INPUT_FIELD',
                        name: 'Server port (1025 - 65535)',
                        init: `${DEFAULT_HTTP_PORT}`,
                        description: 'Server port (1025 - 65535)',
                        isValid(text) {
                            const port = Number(text)
                            if (Number.isNaN(port)) return false
                            if (port > 65535 || port <= 0) return false
                            if (port < 1024) return false
                            return true
                        },
                        hidden: (): boolean => !PHYSICSNET || !Opts.serverEnableNet,
                    },
                    serverTitle: {
                        type: 'INPUT_FIELD',
                        name: 'Server title',
                        init: `my server`,
                        description: 'Server title',
                        hidden: (): boolean => !PHYSICSNET || !Opts.serverEnableNet,
                    },
                    serverDescription: {
                        type: 'INPUT_FIELD',
                        name: 'Server description',
                        init: `hello!`,
                        description: 'Server description',
                        hidden: (): boolean => !PHYSICSNET || !Opts.serverEnableNet,
                    },
                },
                server: {
                    serverDisplayServerInstance: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display server inst',
                        description: ' ',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.displayServerInstance = Opts.serverDisplayServerInstance
                            }
                        },
                    },
                    serverDisplayMaps: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display map insts',
                        description: ' ',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.displayMaps = Opts.serverDisplayMaps
                            }
                        },
                    },
                    serverForceMapsActive: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Force maps active',
                        description: 'Prevent maps from becoming inactive',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.forceMapsActive = Opts.serverForceMapsActive
                            }
                        },
                    },
                    serverDisplayInactiveMaps: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display inactive map insts',
                        description: ' ',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.displayInactiveMaps = Opts.serverDisplayInactiveMaps
                            }
                        },
                    },
                    serverDisplayClientInstances: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Display client insts',
                        description: ' ',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.displayClientInstances = Opts.serverDisplayClientInstances
                            }
                        },
                    },
                    serverDisplayRemoteClientInstances: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Display remote client insts',
                        description: ' ',
                        changeEvent() {
                            if (multi.server) {
                                multi.server.settings.displayRemoteClientInstances =
                                    Opts.serverDisplayRemoteClientInstances
                            }
                        },
                    },
                    serverAttemptCrashRecovery: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Attempt crash recovery',
                        description: 'Attempt crash recovery on server crash',
                    },
                },
                'physics server': {
                    serverGlobalTps: {
                        type: 'OBJECT_SLIDER',
                        init: 60,
                        min: 60,
                        max: 240,
                        step: 1,
                        name: 'TPS',
                        description: 'Ticks per second',
                        customNumberDisplay(index) {
                            return index + 60
                        },
                    },
                    serverUseAnimationFrameLoop: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Use requestAnimationFrame',
                        description:
                            'Automaticly use screen refresh rate as tps when no remote clients are on the server',
                    },
                    serverForceConsistentTickTimes: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Force consistent tick times',
                        description: 'Increment the game clock by a constant amount',
                    },
                    serverGodmode: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Godmode',
                        description: 'Set all player stats to max',
                    },
                    serverCopyNewPlayerStats: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Copy stats for new players',
                        description: 'Gives new players cloned stats of the first player on the same map',
                        changeEvent() {
                            if (multi.server instanceof PhysicsServer) {
                                multi.server.settings.copyNewPlayerStats = Opts.serverCopyNewPlayerStats
                            }
                        },
                    },
                    serverEnableSave: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Enable saving',
                        description: 'Enable saving to save slots',
                    },
                    serverForceJsonCommunication: {
                        type: 'CHECKBOX',
                        init: false,
                        name: 'Force JSON communication',
                        description: 'Disable message binary encoding',
                    },
                    serverMapSwitchDelay: {
                        type: 'OBJECT_SLIDER',
                        init: 300,
                        min: 0,
                        max: 1000,
                        step: 100,
                        thumbWidth: 60,
                        name: 'Map switch delay',
                        description: 'Map switch delay',
                        customNumberDisplay(index) {
                            // @ts-expect-error
                            return `${this.min + index * this.step} ms`
                        },
                    },
                },
                'remote server': {
                    serverTimeSynchronization: {
                        type: 'CHECKBOX',
                        init: true,
                        name: 'Synchronize time',
                        description: 'Required for accurate ping measurements',
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
        /* trigger option chengeEvent */
        Opts.clientLogin = defaultClientUsername
    }
})
