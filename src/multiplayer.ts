export const DEFAULT_PORT = 33405

import 'setimmediate'

import './misc/entity-uuid'
import { Server } from './server/server'
import { assert } from './misc/assert'
// import './misc/skip-title-screen'
// import './misc/godmode'
// import './misc/gamepad-focus-fix'

export class Multiplayer {
    headless: boolean = false

    server!: Server

    constructor() {
        this.headless = !!window.crossnode
        this.init()
    }
    private async init() {
        await import('./game-loop')
    }

    setServer(server: Server) {
        assert(!this.server, 'Server already set!')
        this.server = server
    }
}
