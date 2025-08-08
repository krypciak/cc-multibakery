import { Server } from './server/server'
import { assert } from './misc/assert'
import { prestart } from './plugin'

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
        function setServer(server: Server): void
        function destroy(): void
        function destroyAndStartLoop(): void
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
        destroyOnNext: false,
        class: {} as any,
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
    }
}

prestart(() => {
    global.multi = window.multi = initMultiplayer()
}, 0)
