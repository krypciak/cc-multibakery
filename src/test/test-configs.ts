import type { PhysicsServerSettings } from '../server/physics/physics-server-types'

export interface TestServerConfig {
    serverSettings: PhysicsServerSettings
    crossnodeForceWriteImage: boolean
    disablePerfFlags: boolean
    printRemoteServerLogs: boolean
    remoteJavascriptEngine: 'node' | 'bun'
    testFilterRegex?: RegExp
}

function withFilter(config: TestServerConfig, filter: RegExp): TestServerConfig {
    return { ...config, testFilterRegex: filter }
}

const base: TestServerConfig = {
    serverSettings: {
        gameTps: 60,
        forceConsistentTickTimes: true,
        gameLoopIntervalTps: 240,
        displayClientInstances: !window.crossnode?.options.nukeImageStack,
        displayRemoteClientInstances: !window.crossnode?.options.nukeImageStack,

        attemptCrashRecovery: true,
        useAnimationFrameAsFpsLimiter: true,
    },
    crossnodeForceWriteImage: false && !window.crossnode?.options.nukeImageStack,
    disablePerfFlags: true,
    printRemoteServerLogs: false,
    remoteJavascriptEngine: 'node',
}

const physics: TestServerConfig = {
    ...base,
    serverSettings: { ...base.serverSettings },
    testFilterRegex: /^physics/,
}

const remote: TestServerConfig = {
    ...base,
    serverSettings: {
        ...base.serverSettings,
        gameLoopIntervalTps: 60,

        netInfo: {
            connection: {
                httpPort: 0,
                transport: { type: 'socket.io' },
            },
            details: {
                title: 'tests',
                description: 'do not join!',
            },
        },
    },
    testFilterRegex: /^remote/,
}

export const chosenTestServerConfig: TestServerConfig = withFilter(remote, /^remote Lea NEUTRAL/)
