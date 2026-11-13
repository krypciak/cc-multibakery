import type { ReplOptions, REPLServer } from 'repl'
import { assert } from './assert'

export class Repl {
    private server?: REPLServer

    constructor() {
        assert(window.crossnode)
    }

    async start() {
        const repl: typeof import('repl') = (0, eval)(`require('repl')`)
        const settings = { prompt: 'cc-multibakery > ', useGlobal: true, ignoreUndefined: true } satisfies ReplOptions
        const server = repl.start(settings)
        this.server = server

        server.on('exit', () => {
            setTimeout(() => process.exit(), 0)
        })
        server.defineCommand('clients', {
            help: 'Display client names',
            action() {
                console.log([...multi.server.clients.keys()])
                server.displayPrompt()
            },
        })
        server.defineCommand('kick', {
            help: 'Kick client',
            action(cmd?: string) {
                cmd ??= ''
                let spaceIndex = cmd.indexOf(' ')
                if (spaceIndex == -1) spaceIndex = cmd.length
                const username = cmd.substring(0, spaceIndex)
                const reason = cmd.substring(spaceIndex).trim()

                const client = multi.server.clients.get(username)
                if (!client) {
                    console.error(`Client: "${username}" not found!`)
                    server.displayPrompt()
                    return
                }
                multi.server.leaveClient(client, { reason })
                server.displayPrompt()
            },
        })
    }

    destroy() {
        this.server?.close()
    }
}
