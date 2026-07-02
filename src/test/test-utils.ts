import { assert } from '../misc/assert'
import { preload } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import type { MapTpInfo } from '../server/server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { Opts } from '../options'
import type { TestConfig } from './test-bridge'
import type { Client } from '../client/client'
import type { CCMap } from '../server/ccmap/ccmap'
import { assertPhysics } from '../server/physics/is-physics-server'
import type { TestRemoteClientRaport, TestRemoteClientRequestConfig } from './test-setup-mod-side'

import './test-setup-mod-side'

declare global {
    namespace multi {
        var test: MultibakeryTestUtils
    }
}

class MultibakeryTestUtils {
    private setupServerPromise: Promise<void> | undefined
    private gameTps = 60
    private actualTps = 60 // 240
    private displayClientInstances = !window.crossnode?.options.nukeImageStack
    private crossnodeForceWriteImage = false && !window.crossnode?.options.nukeImageStack
    private disablePerfFlags = true
    private printRemoteServerLogs = false
    remoteRaports: Record<string, Promise<TestRemoteClientRaport>> = {}

    async setupServerIfNeeded() {
        assert(TEST)
        if (this.setupServerPromise) return this.setupServerPromise
        return (this.setupServerPromise = this.setupServer())
    }

    private async setupServer() {
        if (this.disablePerfFlags) {
            ig.perf.spriteShadow = false
            ig.perf.spriteOverlapSolver = false
            ig.perf.gui = false
            ig.perf.lighting = false
            ig.perf.weather = false
            ig.perf.overlay = false
            ig.perf.envParticles = false
            ig.perf.spriteFilter = false
        }

        multi.setServer(
            new PhysicsServer({
                gameTps: this.gameTps,
                forceConsistentTickTimes: true,
                gameLoopIntervalTps: this.actualTps,
                displayClientInstances: this.displayClientInstances,
                displayRemoteClientInstances: this.displayClientInstances,
                attemptCrashRecovery: true,
                useAnimationFrameAsFpsLimiter: true,
                // displayServerInstance: true,

                netInfo: {
                    connection: {
                        httpPort: 33406,
                        transport: { type: 'socket.io' },
                    },
                    details: {
                        title: 'tests',
                        description: 'do not join!',
                    },
                },
            })
        )
        await multi.server.start()

        instanceinator.displayFps = true
        Opts.showServerTps = true
    }

    async createClient({
        username,
        tpInfo,
        test,
        tilingOrder,
        remote,
    }: {
        username: string
        test: TestConfig
        tpInfo?: MapTpInfo
        tilingOrder?: number
        remote?: boolean
    }) {
        const { client, map } = await (remote
            ? this.requestRemoteClientToJoin(username)
            : multi.server.createAndJoinClient(
                  { username, preferredTpInfo: tpInfo },
                  { awaitClientJoin: true, clientSettingsOverride: { inputType: 'puppet', tilingOrder } }
              ))
        assert(client)
        assert(map)

        if (remote) {
            /* when remote is true, tilingOrder is not set */
            if (tilingOrder !== undefined) client.inst.tilingOrder = tilingOrder
            instanceinator.retile()
        }

        map.attachedTest = test
        client.inst.crossnodeForceWriteImage = this.crossnodeForceWriteImage

        return { client, map }
    }

    private async requestRemoteClientToJoin(username: string) {
        assertPhysics(multi.server)
        const port = multi.server.settings.netInfo?.connection.httpPort
        assert(port, 'net manager is not running!')

        await this.spawnRemoteServer({ port, username })

        let client: Client | undefined
        let map: CCMap | undefined
        await multi.test.updateLoop(multi.server.inst, multi.server.settings.gameTps * 15, () => {
            client = multi.server.clients.get(username)
            if (client?.ready) {
                map = client.getMap()
                return true
            }
        })
        assert(client, 'client undefined after waiting')
        assert(map, 'map undefined after waiting')

        /* wait because if we dont wait lvl3 combat arts execute instead of lvl2 for some reason */
        await multi.test.waitFrames(client.inst, 10)

        return { client, map }
    }

    private async spawnRemoteServer(config: TestRemoteClientRequestConfig) {
        const child_process: typeof import('child_process') = (0, eval)(`require('child_process')`)

        let resolve: (raport: TestRemoteClientRaport) => void
        this.remoteRaports[config.username] = new Promise<TestRemoteClientRaport>(res => (resolve = res))

        const errors: string[] = []

        const print = this.printRemoteServerLogs

        print && console.log('REMOTE spawning', config)
        const child = child_process.spawn(
            'bun',
            ['run', 'scripts/server.js', 'remoteServer', `${JSON.stringify(config)}`],
            {
                cwd: 'assets/mods/cc-multibakery',
            }
        )
        child.stdout!.on('data', dataRaw => {
            const data = String(dataRaw).trim()
            print && console.log(`REMOTE ${config.username}: ${data}`)

            if (data.startsWith('RAPORT:')) {
                const raportStr = data.substring(data.indexOf(' ')).trim()
                const raport: TestRemoteClientRaport = JSON.parse(raportStr)
                raport.errors ??= []
                raport.errors.push(...errors)
                resolve(raport)
            }
        })

        child.stderr!.on('data', dataRaw => {
            const data = String(dataRaw).trim()
            print && console.error(`REMOTE ${config.username}: ${data}`)
            errors.push(data)
        })

        child.on('close', code => {
            print && console.log(`REMOTE ${config.username}: Process exited with code ${code}`)
        })
    }

    updateLoop(
        inst: InstanceinatorInstance,
        maxFrames: number,
        func: (frame: number) => boolean | undefined | void | Promise<boolean | undefined | void>
    ) {
        return new Promise<void>((res, rej) => {
            let frames = 0
            const loop = async () => {
                if (inst.destroyed) {
                    res()
                    return
                }
                try {
                    const done = await func(frames)
                    if (done || ++frames >= maxFrames) {
                        res()
                    } else {
                        scheduleTask(inst, loop)
                    }
                } catch (e) {
                    rej(e)
                    throw e
                }
            }
            runTask(inst, loop)
        })
    }

    async waitFrames(inst: InstanceinatorInstance, count: number) {
        await this.updateLoop(inst, count + 1, () => {})
    }
}

if (TEST) {
    preload(() => {
        multi.test = new MultibakeryTestUtils()
        import('./test-bridge')
    }, 1)
}
