/* in prestart */
export {}
ig.main = function () {
    const canvasId = '#canvas'
    const inputDomId = '#game'
    const fps = 60
    const width = IG_WIDTH
    const height = IG_HEIGHT
    const scale = 4
    ig.currentLang = window.IG_LANG = 'en_US'

    ig.system = new ig.System(canvasId, inputDomId, fps, width, height, scale)
    ig.lang = new ig.Lang()
    ig.input = new ig.Input()
    ig.soundManager = new ig.SoundManager()
    ig.music = new ig.Music()
    ig.ready = true
    ig.mainLoader = new sc.StartLoader(sc.CrossCode)
    ig.mainLoader.load()
}

ig.System.inject({
    startRunLoop() {
        this.frame = 0
        this.stopRunLoop()
        if (!server.headless && window.requestAnimationFrame) {
            window.requestAnimationFrame(drawLoop)
        }
        this.intervalId = setInterval(this.run.bind(this), 1e3 / server.server.s.globalTps) as unknown as number

        this.running = true
    },
    run() {
        try {
            runLoop()
        } catch (err) {
            ig.system.error(err as Error)
        }
    },
})

// let di = 0
// let dd = Date.now()
// let dc = 0
function drawLoop() {
    if (!ig.system.hasFocusLost() && !ig.game.fullyStopped && !server.headless && ig.perf.draw) {
        ig.game.draw()
        ig.game.finalDraw()
    }

    // di++
    // if (di % 120 == 0) {
    //     dc = (di / (Date.now() - dd)) * 1000
    //     di = 0
    //     dd = Date.now()
    // }

    window.requestAnimationFrame(drawLoop)
}

// let pi = 0
// let pd = Date.now()
// let pc = 0

let previousMusicTime = 0
function runLoop() {
    ig.system.frame += 1
    if (ig.system.frame % ig.system.frameSkip == 0) {
        ig.Timer.step()
        ig.system.rawTick = ig.system.actualTick =
            Math.min(ig.Timer.maxStep, ig.system.clock.tick()) * ig.system.totalTimeFactor
        if (ig.system.hasFocusLost()) ig.system.actualTick = 0
        ig.system.tick = ig.system.actualTick * ig.system.timeFactor

        if (!server.headless) {
            const currentMusicTime = ig.soundManager.context.getCurrentTimeRaw()
            ig.soundManager.context.timeOffset =
                currentMusicTime == previousMusicTime ? ig.soundManager.context.timeOffset + ig.system.rawTick : 0
            previousMusicTime = currentMusicTime
        }

        // if (ig.system.skipMode) {
        //     ig.system.tick = ig.system.tick * 8
        //     ig.system.actualTick = ig.system.actualTick * 8
        // }
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
            /* skip all cutscenes, but time speedup is disabled */

            ig.system.skipMode = true
            this.fullyStopped = false

            const tick = ig.system.actualTick
            let nextTick = tick

            /* update loop todo */
            for (this.firstUpdateLoop = true; nextTick > 0; ) {
                ig.system.actualTick = Math.min(0.05, nextTick)
                ig.system.tick = ig.system.actualTick * ig.system.timeFactor
                this.update()
                this.firstUpdateLoop = false
                nextTick = nextTick - ig.system.actualTick
            }

            ig.system.actualTick = tick
            ig.system.tick = ig.system.actualTick * ig.system.timeFactor
            this.firstUpdateLoop = true
            /* todo */
            ig.perf.deferredUpdate && this.deferredUpdate()

            ig.input.clearPressed()

            if (!server.headless) {
                ig.soundManager.update()
            }
        }
    },
})
