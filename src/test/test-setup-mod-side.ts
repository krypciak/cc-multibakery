import { assert } from '../misc/assert'
import { preload } from '../loading-stages'
import { PhysicsServer } from '../server/physics/physics-server'
import type { MapTpInfo } from '../server/server'
import { generateRandomUsername } from '../misc/username-util'
import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { runTask, scheduleNextTask } from 'cc-instanceinator/src/inst-util'

declare global {
    namespace multi {
        var test: MultibakeryTestUtils
    }
}

class MultibakeryTestUtils {
    private setupServerPromise: Promise<void> | undefined

    async setupServerIfNeeded() {
        assert(TEST)
        if (this.setupServerPromise) return this.setupServerPromise
        return (this.setupServerPromise = this.setupServer())
    }

    private async setupServer() {
        ig.perf.spriteShadow = false
        ig.perf.spriteOverlapSolver = false
        ig.perf.gui = false
        ig.perf.lighting = false
        ig.perf.weather = false
        ig.perf.overlay = false
        ig.perf.envParticles = false
        ig.perf.spriteFilter = false

        const skipFrameWait = true
        multi.setServer(
            new PhysicsServer({
                tps: 60,
                forceConsistentTickTimes: true,
                intervalFps: skipFrameWait ? Infinity : undefined,

                displayClientInstances: !window.crossnode?.options.nukeImageStack,
            })
        )
        await multi.server.start()

        instanceinator.displayFps = true
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
