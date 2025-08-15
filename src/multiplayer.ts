import { Server } from './server/server'
import { assert } from './misc/assert'
import { poststart, prestart } from './plugin'
import { getStepCount } from './misc/steps/step-id'

// import './misc/skip-title-screen'
import './misc/entity-netid'
import './game-loop'
import './misc/godmode'
import './dummy/dummy-player'
import './state/states'
import './misc/paused-virtual'
import './misc/disable-fkeys'
import './client/menu/server-list-menu'
import './client/menu/pause/pause-screen'
import './pvp/pvp'
import './misc/steps/all'

declare global {
    namespace multi {
        var server: Server
        var stepCount: number

        function setServer(server: Server): void
        function destroy(): void
        function destroyAndStartLoop(): void
        function destroyNextFrameAndStartLoop(): Promise<void>
    }
    namespace NodeJS {
        interface Global {
            multi: typeof window.multi
        }
    }
}

function initMultiplayer() {
    return {
        class: {} as any,

        server: undefined as any,
        stepCount: 0,

        setServer(server: Server) {
            assert(!this.server)
            this.server = server
        },
        destroy() {
            this.server.destroy()
            this.server = undefined as any
        },
        destroyAndStartLoop() {
            this.destroy()
            ig.system.startRunLoop()
        },
        async destroyNextFrameAndStartLoop() {
            await new Promise<void>(resolve => {
                multi.server.postUpdateCallback = resolve
            })
            this.destroy()
            ig.system.startRunLoop()
        },
    }
}

prestart(() => {
    global.multi = window.multi = initMultiplayer()
}, 0)
poststart(() => {
    multi.stepCount = getStepCount()
})
