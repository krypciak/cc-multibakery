import { Server } from './server'

declare global {
    namespace ig {
        var multiplayer: Multiplayer
    }
}
export const DEFAULT_PORT = 33405

export class Multiplayer {
    headless: boolean = false

    servers: Record<string, Server> = {}
    /* current processed server */
    server!: Server

    constructor() {
        import('./game-loop')
        import('./update-loop')
    }

    appendServer(server: Server) {
        ig.multiplayer.servers[server.s.name] = server
    }

    start() {
        this.server = Object.values(this.servers)[0]
        this.server.start()
    }
}
