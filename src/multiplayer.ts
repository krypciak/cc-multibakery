import { Server } from './server/server'
import { assert } from './misc/assert'

// import 'setimmediate'

// import './misc/skip-title-screen'
import './misc/entity-uuid'
import './game-loop'
import './misc/godmode'
import './misc/gamepad-focus-fix'
import './dummy-player'

export const DEFAULT_PORT = 33405

export class Multiplayer {
    headless: boolean = false

    server!: Server

    constructor() {
        this.headless = !!window.crossnode
    }

    setServer(server: Server) {
        assert(!this.server, 'Server already set!')
        this.server = server
    }
}
