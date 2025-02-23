import type { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { assert } from './misc/assert'
import { prestart } from './plugin'
import { LocalServer } from './server/local-server'

export {}
declare global {
    namespace ig {
        interface System {
            frame: number
            animationFrameRequestId: number
        }
    }
}
export function startGameLoop() {
    assert(multi.server, 'multi.server is null when running startClientGameLoop!')

    ig.system.frame = 0

    if (window.crossnode?.options.test) {
        // console.log('crossnode, start your game loop now!!')
        return
    }

    ig.system.stopRunLoop()

    if (!multi.headless && ig.perf.draw && window.requestAnimationFrame) {
        window.requestAnimationFrame(drawLoop)
    }

    const tps = 1e3 / multi.server.s.globalTps
    ig.system.intervalId = setInterval(() => {
        ig.system.run()
    }, tps) as unknown as number

    ig.system.running = true
}

prestart(() => {
    ig.System.inject({
        stopRunLoop() {
            if (window.cancelAnimationFrame) {
                window.cancelAnimationFrame(this.animationFrameRequestId)
            }
            this.parent()
        },
        run() {
            if (!multi.server) return this.parent()
            if (multi.server instanceof LocalServer) {
                if (!multi.server.serverInst) return
                assert(instanceinator.instanceId == multi.server.serverInst.id)
            }
            // if (!this.running) {
            //     console.log('not running, return', instanceinator.instanceId)
            //     return
            // }

            try {
                physicsLoop()
                if (window.crossnode) draw()
            } catch (err) {
                ig.system.error(err as Error)
            }
        },
    })
})

function draw() {
    for (const inst of Object.values(instanceinator.instances).filter(i => i.display)) {
        inst.apply()
        if (!ig.system.hasFocusLost() && !ig.game.fullyStopped && ig.perf.draw) {
            ig.game.draw()
            ig.game.finalDraw()
        }
    }
    if (multi.server instanceof LocalServer) multi.server.serverInst.apply()
}
// let di = 0
// let dd = Date.now()
// let dc = 0
function drawLoop() {
    draw()
    // di++
    // if (di % 120 == 0) {
    //     dc = (di / (Date.now() - dd)) * 1000
    //     di = 0
    //     dd = Date.now()
    //     console.log(dc)
    // }
    if (ig.system.fps >= 60 && window.requestAnimationFrame) {
        ig.system.animationFrameRequestId = window.requestAnimationFrame(drawLoop)
    }
}

// let pi = 0
// let pd = Date.now()
// let pc = 0

let previousMusicTime = 0
function physicsLoop() {
    ig.system.frame++
    if (ig.system.frame % ig.system.frameSkip == 0) {
        ig.Timer.step()
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

        if (ig.system.hasFocusLost() && ig.system.cancelFocusLostCallback && ig.system.cancelFocusLostCallback()) {
            ig.system.regainFocus()
        }

        ig.system.delegate.run()
        if (ig.system.newGameClass) {
            ig.system.setGameNow(ig.system.newGameClass)
            ig.system.newGameClass = null
        }
    }

    // pi++
    // if (pi % 120 == 0) {
    //     pc = (pi / (Date.now() - pd)) * 1000
    //     pi = 0
    //     pd = Date.now()
    //     console.log('physics:', pc.floor(), 'draw:', dc.floor())
    // }
}

prestart(() => {
    ig.Game.inject({
        run() {
            if (!multi.server) return this.parent()
            if (multi.server instanceof LocalServer) assert(instanceinator.instanceId == multi.server.serverInst.id)

            if (ig.system.hasFocusLost() && this.fullyStopped) {
                ig.soundManager.update()
            } else {
                this.fullyStopped = false

                const tick = ig.system.actualTick
                let nextTick = tick

                var contextBackup = ig.system.context
                ig.system.context = null

                if (ig.perf.update) {
                    for (this.firstUpdateLoop = true; nextTick > 0; ) {
                        ig.system.actualTick = Math.min(0.05, nextTick)
                        ig.system.tick = ig.system.actualTick * ig.system.timeFactor

                        update()

                        this.firstUpdateLoop = false
                        nextTick = nextTick - ig.system.actualTick
                    }

                    ig.system.actualTick = tick
                    ig.system.tick = ig.system.actualTick * ig.system.timeFactor
                }
                this.firstUpdateLoop = true

                deferredUpdate()

                ig.soundManager.update()
                ig.system.context = contextBackup
            }
        },
    })
})

function update() {
    multi.server.update()
}
function deferredUpdate() {
    multi.server.deferredUpdate()
}

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
