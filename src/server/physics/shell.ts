export async function startRepl() {
    if (!window.crossnode) return

    const repl: typeof import('repl') = await import('repl')
    const server = repl.start({
        prompt: 'cc-multibakery > ',
        useGlobal: true,
        ignoreUndefined: true,
    })
    server.on('exit', () => {
        process.exit()
    })
    server.defineCommand('clients', {
        help: 'Display client names',
        action() {
            console.log(Object.keys(multi.server.clients))
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
