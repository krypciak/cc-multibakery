export {}
declare global {
    namespace ig {
        interface System {
            frame: number
            animationFrameRequestId: number
        }
    }
}
/* in prestart */

ig.System.inject({
    startRunLoop() {
        this.frame = 0
        this.stopRunLoop()
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(drawLoop)
        }
        if (client.isConnected()) {
            const tps = 1e3 / client.serverSettings!.globalTps
            this.intervalId = setInterval(this.run.bind(this), tps) as unknown as number
        }

        this.running = true
    },
    stopRunLoop() {
        if (window.cancelAnimationFrame) {
            window.cancelAnimationFrame(this.animationFrameRequestId)
        }
        clearInterval(this.intervalId)
        this.running = false
    },
    run() {
        try {
            physicsLoop()
        } catch (err) {
            ig.system.error(err as Error)
        }
    },
})

// let di = 0
// let dd = Date.now()
// let dc = 0
function drawLoop() {
    if (!client.isConnected()) {
        physicsLoop()
    }
    if (!ig.system.hasFocusLost() && !ig.game.fullyStopped && ig.perf.draw) {
        ig.game.draw()
        ig.game.finalDraw()
    }

    // di++
    // if (di % 120 == 0) {
    //     dc = (di / (Date.now() - dd)) * 1000
    //     di = 0
    //     dd = Date.now()
    // }
    if (ig.system.fps >= 60 && window.requestAnimationFrame)
        ig.system.animationFrameRequestId = window.requestAnimationFrame(drawLoop)
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

        if (ig.system.skipMode) {
            ig.system.tick = ig.system.tick * 8
            ig.system.actualTick = ig.system.actualTick * 8
        }
        ig.system.hasFocusLost() &&
            ig.system.cancelFocusLostCallback &&
            ig.system.cancelFocusLostCallback() &&
            ig.system.regainFocus()
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

ig.Game.inject({
    run() {
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
                    this.update()
                    this.firstUpdateLoop = false
                    nextTick = nextTick - ig.system.actualTick
                }

                ig.system.actualTick = tick
                ig.system.tick = ig.system.actualTick * ig.system.timeFactor
            }
            this.firstUpdateLoop = true
            ig.perf.deferredUpdate && this.deferredUpdate()

            ig.input.clearPressed()

            ig.soundManager.update()
            ig.system.context = contextBackup
        }
    },
})
