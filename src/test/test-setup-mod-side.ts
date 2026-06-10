import { assert } from '../misc/assert'
import { preload } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import type { MapTpInfo } from '../server/server'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { runTask, scheduleNextTask, scheduleTask } from 'cc-instanceinator/src/inst-util'
import { Opts } from '../options'
import type { TestConfig } from './test-bridge'

import './test-setup-mod-side-all-import'

declare global {
    namespace multi {
        var test: MultibakeryTestUtils
    }
}

class MultibakeryTestUtils {
    private setupServerPromise: Promise<void> | undefined
    private gameTps = 60
    private actualTps = 60 //Infinity
    private displayClientInstances = !window.crossnode?.options.nukeImageStack
    private crossnodeForceWriteImage = false && !window.crossnode?.options.nukeImageStack
    private disablePerfFlags = true

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
                attemptCrashRecovery: true,
                useAnimationFrameAsFpsLimiter: true,
                // displayServerInstance: true,
            })
        )
        await multi.server.start()

        instanceinator.displayFps = true
        Opts.showServerTps = true
    }

    async createClient(username: string, tpInfo: MapTpInfo, test: TestConfig) {
        const { client, map } = await multi.server.createAndJoinClient(
            { username, preferredTpInfo: tpInfo },
            { awaitClientJoin: true, clientSettingsOverride: { inputType: 'puppet' } }
        )
        assert(client)
        assert(map)

        map.attachedTest = test

        client.inst.crossnodeForceWriteImage = this.crossnodeForceWriteImage

        return { client, map }
    }

    updateLoop(inst: InstanceinatorInstance, func: () => boolean | undefined | Promise<boolean | undefined>) {
        return new Promise<void>((res, rej) => {
            const loop = async () => {
                try {
                    const done = await func()
                    if (done) {
                        res()
                    } else {
                        scheduleNextTask(inst, loop)
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
        for (let frame = 0; frame < count; frame++) {
            await scheduleTask(inst, () => {})
        }
    }
}

if (TEST) {
    preload(() => {
        multi.test = new MultibakeryTestUtils()
        import('./test-bridge')
    }, 1)
}
