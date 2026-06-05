import type { REPLServer } from 'repl'
import { assert } from '../../misc/assert'

export class Repl {
    private server?: REPLServer

    constructor() {
        assert(window.crossnode)
    }

    async start() {
        const repl: typeof import('repl') = await import('repl')
        const server = repl.start({
            prompt: 'cc-multibakery > ',
            useGlobal: true,
            ignoreUndefined: true,
        })
        this.server = server

        server.on('exit', () => {
            process.exit()
        })
        server.defineCommand('clients', {
            help: 'Display client names',
            action() {
                console.log(multi.server.clients)
                server.displayPrompt()
            },
        })
        server.defineCommand('kick', {
            help: 'Kick client',
            action(name) {
                const client = multi.server.clients.get(name)
                if (!client) {
                    console.error(`Client: "${name}" not found!`)
                    server.displayPrompt()
                    return
                }
                multi.server.leaveClient(client)
                server.displayPrompt()
            },
        })
    }

    destroy() {
        this.server?.close()
    }
}
