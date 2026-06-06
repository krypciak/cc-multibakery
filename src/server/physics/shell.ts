import type { ReplOptions, REPLServer } from 'repl'
import { assert } from '../../misc/assert'
import type * as readline from 'readline'

class SimpleRepl {
    private rl!: readline.Interface
    private commands = new Map<string, { help: string; action: (name?: string) => void }>()
    private onExit?: () => void

    constructor(private settings: { prompt: string; ignoreUndefined?: boolean }) {
        this.start()
    }

    private async start() {
        const readline: typeof import('readline') = await import('readline')
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.settings.prompt,
            terminal: true,
        })
        this.rl.on('line', this.onLine.bind(this))
        this.rl.on('SIGINT', () => this.rl.close())
        this.rl.on('close', () => this.onExit?.())
        this.rl.prompt()
    }

    defineCommand(name: string, cmd: { help: string; action: (name?: string) => void }) {
        this.commands.set(name, cmd)
    }

    displayPrompt() {
        this.rl.prompt()
    }

    private onLine(line: string) {
        const trimmed = line.trim()
        if (!trimmed) {
            this.rl.prompt()
            return
        }
        if (trimmed.startsWith('.')) {
            this.handleCommand(trimmed)
            return
        }
        this.evaluate(trimmed)
    }

    private handleCommand(input: string) {
        const parts = input.slice(1).split(/\s+/)
        const cmd = parts[0]
        const args = parts.slice(1).join(' ')

        if (cmd === 'help') {
            for (const [name, { help }] of this.commands) {
                console.log(`.${name}  ${help}`)
            }
            this.rl.prompt()
            return
        }

        if (cmd === 'exit') {
            this.rl.close()
            return
        }

        const command = this.commands.get(cmd)
        if (command) {
            command.action(args)
            return
        }

        console.error(`Invalid command: .${cmd}`)
        this.rl.prompt()
    }

    private evaluate(code: string) {
        try {
            const result = (0, eval)(code)
            if (!this.settings.ignoreUndefined || result !== undefined) {
                console.log(result)
            }
        } catch (err) {
            console.error(err)
        }
        this.rl.prompt()
    }

    close() {
        this.rl.close()
    }

    on(event: 'exit', func: () => void) {
        assert(event == 'exit')
        this.onExit = func
    }
}

export class Repl {
    private server?: REPLServer | SimpleRepl

    constructor() {
        assert(window.crossnode)
    }

    async start() {
        const repl: typeof import('repl') = await import('repl')
        const settings = { prompt: 'cc-multibakery > ', useGlobal: true, ignoreUndefined: true } satisfies ReplOptions
        const server = 'start' in repl ? repl.start(settings) : new SimpleRepl(settings)
        this.server = server

        server.on('exit', () => {
            process.exit()
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
            action(name?: string) {
                const client = multi.server.clients.get(name ?? '')
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
