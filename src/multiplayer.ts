import { Server } from './server/server'

// import 'setimmediate'

// import './misc/skip-title-screen'
import './misc/entity-uuid'
import './game-loop'
import './misc/godmode'
import './misc/gamepad-focus-fix'
import './dummy-player'
import './teleport-fix'

export const DEFAULT_PORT = 33405

export class Multiplayer {
    headless: boolean = false

    server!: Server

    constructor() {
        this.headless = !!window.crossnode
    }

    setServer(server: Server) {
        if (this.server) this.destroy()
        this.server = server
    }

    destroy() {
        this.server.destroy()
        this.server = undefined as any
    }
}
