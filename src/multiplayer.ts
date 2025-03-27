import { Server } from './server/server'

// import './misc/skip-title-screen'
import './misc/entity-uuid'
import './game-loop'
import './misc/godmode'
import './dummy/dummy-player'
import './teleport-fix'
import './state/states'
import './misc/paused-virtual'
import './misc/pause-screen'

declare global {
    namespace multi {
        var headless: boolean
        var server: Server
        function setServer(server: Server): void
        function destroy(): Promise<void>
    }
    namespace NodeJS {
        interface Global {
            multi: typeof window.multi
        }
    }
}

export function initMultiplayer() {
    return {
        headless: false,
        server: undefined as any,
        class: {} as any,
        setServer(server: Server) {
            this.server = server
        },
        async destroy() {
            await this.server.destroy()
            this.server = undefined as any
        },
    }
}
