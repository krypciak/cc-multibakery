import { assert } from '../misc/assert'
import { preload } from '../loading-stages'
import type { MapTpInfo } from '../server/server-types'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { runTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { Opts } from '../options'
import type { TestConfig } from './test-bridge'
import type { Client } from '../client/client'
import type { CCMap } from '../server/ccmap/ccmap'
import { assertPhysics } from '../server/physics/physics-server-types'
import type { TestRemoteClientReport, TestRemoteClientRequestConfig } from './test-setup-mod-side'
import { chosenTestServerConfig as config } from './test-configs'

import './test-setup-mod-side'

declare global {
    namespace multi {
        var test: MultibakeryTestUtils
    }
}

class MultibakeryTestUtils {
    private setupServerPromise: Promise<void> | undefined
    remoteReports: Record<string, Promise<TestRemoteClientReport>> = {}

    async setupServerIfNeeded() {
        assert(TEST)
        if (this.setupServerPromise) return this.setupServerPromise
        return (this.setupServerPromise = this.setupServer())
    }

    private async setupServer() {
        if (config.disablePerfFlags) {
            ig.perf.spriteShadow = false
            ig.perf.spriteOverlapSolver = false
            ig.perf.gui = false
            ig.perf.lighting = false
            ig.perf.weather = false
            ig.perf.overlay = false
            ig.perf.envParticles = false
            ig.perf.spriteFilter = false
        }

        multi.setServer(multi.createPhysicsServer(config.serverSettings))
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
        client.inst.crossnodeForceWriteImage = config.crossnodeForceWriteImage

        return { client, map }
    }

    private async requestRemoteClientToJoin(username: string) {
        assertPhysics(multi.server)
        const port = multi.server.settings.netInfo?.connection.httpPort
        assert(port !== undefined, 'net manager is not running!')

        await this.spawnRemoteServer({ port, username })

        let client: Client | undefined
        let map: CCMap | undefined
        await multi.test.updateLoop(multi.server.inst, multi.server.settings.gameLoopIntervalTps! * 10, () => {
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

    private async spawnRemoteServer(remoteConfig: TestRemoteClientRequestConfig) {
        const child_process: typeof import('child_process') = (0, eval)(`require('child_process')`)

        let resolve: (report: TestRemoteClientReport) => void
        this.remoteReports[remoteConfig.username] = new Promise<TestRemoteClientReport>(res => (resolve = res))

        const errors: string[] = []

        const print = config.printRemoteServerLogs

        print && console.log('REMOTE spawning', remoteConfig)

        const jsEngine = config.remoteJavascriptEngine

        const child = child_process.spawn(
            jsEngine,
            [
                ...(jsEngine == 'node' ? ['--enable-source-maps', '--no-warnings'] : ['run']),
                'scripts/run.ts',
                'remoteServer',
                `${JSON.stringify(remoteConfig)}`,
            ],
            {
                cwd: 'assets/mods/cc-multibakery',
            }
        )
        child.stdout!.on('data', dataRaw => {
            const data = String(dataRaw).trim()
            print && console.log(`REMOTE ${remoteConfig.username}: ${data}`)

            if (data.startsWith('REPORT:')) {
                const reportStr = data.substring(data.indexOf(' ')).trim()
                const report: TestRemoteClientReport = JSON.parse(reportStr)
                report.errors ??= []
                report.errors.push(...errors)
                resolve(report)
            }
        })

        child.stderr!.on('data', dataRaw => {
            const data = String(dataRaw).trim()
            print && console.error(`REMOTE ${remoteConfig.username}: ${data}`)
            errors.push(data)
        })

        child.on('close', code => {
            print && console.log(`REMOTE ${remoteConfig.username}: Process exited with code ${code}`)
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
                    const done = await runTask(inst, () => func(frames))
                    if (done || ++frames >= maxFrames) {
                        res()
                    } else {
                        if (inst.destroyed) {
                            res()
                            return
                        }
                        scheduleTask(multi.server.inst, loop)
                    }
                } catch (e) {
                    rej(e)
                    throw e
                }
            }
            runTask(multi.server.inst, loop)
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
