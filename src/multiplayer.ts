import { Server } from './server/server'
import { assert } from './misc/assert'
import { prestart } from './plugin'

// import './misc/skip-title-screen'
import './misc/entity-netid'
import './game-loop'
import './misc/godmode'
import './dummy/dummy-player'
import './teleport-fix'
import './state/states'
import './misc/paused-virtual'
import './misc/disable-fkeys'
import './misc/disallow-singleplayer'
import './client/menu/server-list-menu'
import './client/menu/pause/pause-screen'

declare global {
    namespace multi {
        var server: Server
        function setServer(server: Server): void
        function destroy(): Promise<void>
        function destroyAndStartLoop(): Promise<void>
    }
    namespace NodeJS {
        interface Global {
            multi: typeof window.multi
        }
    }
}

function initMultiplayer() {
    return {
        server: undefined as any,
        class: {} as any,
        setServer(server: Server) {
            assert(!this.server)
            this.server = server
        },
        async destroy() {
            await this.server.destroy()
            this.server = undefined as any
        },
        async destroyAndStartLoop() {
            await this.destroy()
            ig.system.startRunLoop()
        },
    }
}

prestart(() => {
    global.multi = window.multi = initMultiplayer()
}, 0)
