import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from './misc/assert'
import { prestart } from './loading-stages'
import { runTasks } from 'cc-instanceinator/src/inst-util'

export {}
declare global {
    namespace ig {
        interface System {
            frame: number
            animationFrameId: number
        }
    }
}
export function startGameLoop(useAnimationFrame = false) {
    assert(multi.server, 'multi.server is null when running startClientGameLoop!')

    ig.system.frame = 0

    if (window.crossnode?.options.test) {
        return
    }

    ig.system.stopRunLoop()

    if (useAnimationFrame && !window.requestAnimationFrame) {
        console.warn(
            'useAnimationFrameLoop is enabled, but window.requestAnimationFrame is undefined! defaulting to setInterval'
        )
    }

    function run() {
        ig.system.run()
    }

    if (useAnimationFrame && window.requestAnimationFrame) {
        function loop() {
            run()
            window.requestAnimationFrame(loop)
        }
        window.requestAnimationFrame(loop)
    } else {
        const interval = 1e3 / multi.server.settings.tps
        ig.system.intervalId = setInterval(run, interval) as unknown as number
    }

    ig.system.running = true
}

prestart(() => {
    const orig = window.requestAnimationFrame
    if (orig) {
        window.requestAnimationFrame = callback => {
            const id = orig(callback)
            ig.system.animationFrameId = id
            return id
        }
    }

    ig.System.inject({
        stopRunLoop() {
            this.parent()
            window.cancelAnimationFrame(this.animationFrameId)
        },
        run() {
            if (!ig.system.running) return

            if (!multi.server) return this.parent()

            if (!multi.server.serverInst) return
            assert(instanceinator.id == multi.server.serverInst.inst.id)

            try {
                physicsLoop()
                draw()
            } catch (err) {
                multi.server?.onInstanceUpdateError(err)
            }
        },
    })
})

function draw() {
    runTasks(Object.values(instanceinator.instances), () => {
        if (!ig.system.hasFocusLost() && !ig.game.fullyStopped && ig.perf.draw) {
            ig.game.draw()
            ig.game.finalDraw()
        }
    })
    if (multi.server) assert(instanceinator.id == multi.server?.serverInst.inst.id)
}

let previousMusicTime = 0
function physicsLoop() {
    ig.system.frame++
    if (ig.system.frame % ig.system.frameSkip == 0) {
        if (multi.server.settings.forceConsistentTickTimes) {
            const time = ig.Timer._last + 1000 / multi.server.settings.tps
            ig.Timer.time += Math.min((time - ig.Timer._last) / 1e3, ig.Timer.maxStep) * ig.Timer.timeScale
            ig.Timer._last = time
        } else {
            ig.Timer.step()
        }
        ig.system.rawTick = ig.system.actualTick =
            Math.min(ig.Timer.maxStep, ig.system.clock.tick()) * ig.system.totalTimeFactor
        if (ig.system.hasFocusLost()) ig.system.actualTick = 0
        ig.system.tick = ig.system.actualTick * ig.system.timeFactor

        const currentMusicTime = ig.soundManager.context.getCurrentTimeRaw()
        ig.soundManager.context.timeOffset =
            currentMusicTime == previousMusicTime ? ig.soundManager.context.timeOffset + ig.system.rawTick : 0
        previousMusicTime = currentMusicTime

        // if (ig.system.skipMode) {
        //     ig.system.tick = ig.system.tick * 8
        //     ig.system.actualTick = ig.system.actualTick * 8
        // }

        if (ig.system.hasFocusLost() && ig.system.cancelFocusLostCallback?.()) {
            ig.system.regainFocus()
        }

        ig.system.delegate.run()
        if (ig.system.newGameClass) {
            ig.system.setGameNow(ig.system.newGameClass)
            ig.system.newGameClass = null
        }
    }
}

prestart(() => {
    ig.Game.inject({
        run() {
            if (!multi.server) return this.parent()

            assert(instanceinator.id == multi.server.serverInst.inst.id)

            if (!(ig.system.hasFocusLost() && this.fullyStopped)) {
                this.fullyStopped = false

                const tick = ig.system.actualTick
                let nextTick = tick

                if (ig.perf.update) {
                    for (this.firstUpdateLoop = true; nextTick > 0; ) {
                        ig.system.actualTick = Math.min(0.05, nextTick)
                        ig.system.tick = ig.system.actualTick * ig.system.timeFactor

                        multi.server.update()
                        assert(instanceinator.id == multi.server.serverInst.inst.id)

                        this.firstUpdateLoop = false
                        nextTick -= ig.system.actualTick
                    }

                    ig.system.actualTick = tick
                    ig.system.tick = ig.system.actualTick * ig.system.timeFactor
                }
                this.firstUpdateLoop = true

                multi.server.deferredUpdate()
                assert(instanceinator.instances[instanceinator.id])
            }
            ig.soundManager.update()
        },
    })
})

export function copyTickInfo(from: InstanceinatorInstance, to: InstanceinatorInstance) {
    to.ig.system.frame = from.ig.system.frame
    to.ig.system.rawTick = from.ig.system.rawTick
    to.ig.Timer.time = from.ig.Timer.time
    to.ig.Timer._last = from.ig.Timer._last

    to.ig.game.fullyStopped = from.ig.game.fullyStopped
    to.ig.system.actualTick = from.ig.system.actualTick
    to.ig.system.tick = from.ig.system.tick
    to.ig.game.firstUpdateLoop = from.ig.game.firstUpdateLoop
}
