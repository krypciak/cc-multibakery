import { assert } from '../misc/assert'
import { preload } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import type { MapTpInfo } from '../server/server'
import { generateRandomUsername } from '../misc/username-util'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { runTask, scheduleNextTask } from 'cc-instanceinator/src/inst-util'
import { Opts } from '../options'

declare global {
    namespace multi {
        var test: MultibakeryTestUtils
    }
}

class MultibakeryTestUtils {
    private setupServerPromise: Promise<void> | undefined
    private tps = 60
    private intervalFps = Infinity
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
                tps: this.tps,
                forceConsistentTickTimes: true,
                intervalFps: this.intervalFps,
                displayClientInstances: this.displayClientInstances,
            })
        )
        await multi.server.start()

        instanceinator.displayFps = true
        Opts.showServerTps = true
    }

    async createClient(tpInfo: MapTpInfo) {
        const username = generateRandomUsername()
        const { client } = await multi.server.createAndJoinClient(
            { username, prefferedTpInfo: tpInfo },
            { awaitClientJoin: true, clientSettingsOverride: { inputType: 'puppet' } }
        )
        assert(client)

        const map = multi.server.maps.get(tpInfo.map)!
        assert(map)

        client.inst.crossnodeForceWriteImage = this.crossnodeForceWriteImage

        return { client, map }
    }

    async updateLoop(inst: InstanceinatorInstance, func: () => boolean | undefined | Promise<boolean | undefined>) {
        await new Promise<void>(res => {
            const loop = async () => {
                const done = await func()
                if (done) {
                    res()
                } else {
                    scheduleNextTask(inst, loop)
                }
            }
            runTask(inst, loop)
        })
    }
}

if (TEST) {
    preload(() => {
        multi.test = new MultibakeryTestUtils()
        import('./tester')

        import('./aoc/aoc2024d15')
    }, 1)
}
