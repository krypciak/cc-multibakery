import type { Server } from './server/server'
import { assert } from './misc/assert'
import { preload } from './loading-stages'

import './server/physics/create-physics-server'
import './server/remote/try-join-remote'
import './misc/entity-netid'
import './game-loop'
import './misc/godmode'
import './dummy/dummy-player'
import './state/states-all'
import './misc/paused-virtual'
import './misc/disable-fkeys'
import './misc/unregister'
import './pvp/pvp'
import './steps/all'
import './misc/icons'
import './mod-compatibility/all'
import './server/instance-redirect-fixes'

declare global {
    namespace multi {
        var server: Server

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

function initMultiplayer(): typeof window.multi {
    return {
        class: {} as any,

        setServer(server: Server) {
            assert(!multi.server)
            multi.server = server
        },
        destroy() {
            multi.server.destroy()
            multi.server = undefined as any
            if (Object.keys(instanceinator).length == 1) {
                instanceinator.resetInstanceIdCounter()
            }
        },
        destroyAndStartLoop() {
            multi.destroy()
            ig.system.startRunLoop()
        },
        async destroyNextFrameAndStartLoop() {
            await new Promise<void>(resolve => {
                multi.server.postUpdateCallback = resolve
            })
            multi.destroy()
            ig.system.startRunLoop()
        },
    } satisfies Partial<typeof window.multi> as typeof window.multi
}

preload(() => {
    global.multi = window.multi = initMultiplayer()
}, 0)
