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
        if (!ig.multiplayer.headless && window.requestAnimationFrame) {
            window.requestAnimationFrame(this.run.bind(this))
        } else {
            this.intervalId = setInterval(
                this.run.bind(this),
                1e3 / ig.multiplayer.server.s.globalTps
            ) as unknown as number
        }
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

let previousMusicTime = 0
function runLoop() {
    ig.system.frame += 1
    if (ig.system.frame % ig.system.frameSkip == 0) {
        ig.Timer.step()
        ig.system.rawTick = ig.system.actualTick =
            Math.min(ig.Timer.maxStep, ig.system.clock.tick()) * ig.system.totalTimeFactor
        if (ig.system.hasFocusLost()) ig.system.actualTick = 0
        ig.system.tick = ig.system.actualTick * ig.system.timeFactor

        if (!ig.multiplayer.headless) {
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
    !ig.multiplayer.headless &&
        window.requestAnimationFrame &&
        window.requestAnimationFrame(ig.system.run.bind(ig.system))
}

ig.Game.inject({
    run() {
        if (ig.system.hasFocusLost() && this.fullyStopped) {
            ig.soundManager.update()
        } else {
            /* skip all cutscenes, but time speedup is disabled */

            ig.system.skipMode = true
            this.fullyStopped = false
            const context = ig.system.context
            ig.system.context = null

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

            if (!ig.multiplayer.headless) {
                ig.soundManager.update()
                ig.system.context = context
                if (ig.perf.draw) {
                    this.draw()
                    this.finalDraw()
                }
            }
        }
    },
})
