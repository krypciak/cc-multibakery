import { prestart } from '../plugin'

/* used in the client, shouldnt be used in the server */

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
            if (multi.client) return
            if (orig != paused && paused) ig.soundManager.popPaused()
            this.paused = false
            this.pausedVirtual = paused
        },
    })
})
