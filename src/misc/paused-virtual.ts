import { prestart } from '../plugin'

declare global {
    namespace ig {
        interface Game {
            pausedVirtual: boolean
        }
    }
}
prestart(() => {
    ig.Game.inject({
        setPaused(paused) {
            const orig = this.paused
            this.parent(paused)
            if (!multi.server) return
            if (orig != paused && paused) ig.soundManager.popPaused()
            this.paused = false
            this.pausedVirtual = paused
        },
    })
})
