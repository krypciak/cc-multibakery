import * as esbuild from 'esbuild'
import * as fs from 'fs'

interface Options {
    sourcemap?: boolean
    physics?: boolean
    physicsnet?: boolean
    remote?: boolean
    browser?: boolean
    minifySyntax?: boolean
    minifyWhitespace?: boolean
    minifyIdentifiers?: boolean
    extraTreeShaking?: boolean
    target?: string
    dropAssert?: boolean
}

async function run(
    type: 'build' | 'watch',
    {
        sourcemap = true,
        physics = true,
        physicsnet = true,
        remote = true,
        browser = false,
        minifySyntax = false,
        minifyWhitespace = false,
        minifyIdentifiers = false,
        extraTreeShaking = false,
        target = 'es2018',
        dropAssert = false,
    }: Options
) {
    const outputFile = 'plugin.js'

    const commonOptions = {
        target,
        platform: 'node',
        format: 'esm',
        logOverride: { bigint: 'silent' },
        minifySyntax,
        minifyWhitespace,
        minifyIdentifiers,
        sourcemap: sourcemap ? 'inline' : undefined,
        treeShaking: true,
    } as const satisfies Partial<esbuild.BuildOptions>

    const plugin: esbuild.Plugin = {
        name: 'print',
        setup(build) {
            build.onEnd(async res => {
                let output = res.outputFiles?.[0]?.text
                if (!output) return

                if (extraTreeShaking) {
                    const result = await esbuild.transform(output, commonOptions)
                    output = result.code as string
                }

                await fs.promises.writeFile(outputFile, output)

                const bytes = output.length
                const kb = bytes / 1024
                console.log(outputFile, kb.toFixed(1) + 'kb')
            })

            if (dropAssert || !remote || !physics) {
                build.onLoad({ filter: /src.+\.(js|ts)$/ }, async args => {
                    let code = await fs.promises.readFile(args.path, 'utf8')
                    let sp = code.split('\n')
                    if (dropAssert) {
                        sp = sp.map(line =>
                            line
                                .replace(/^\s*(else )?(if \(.*\) )?assert\(.*\)$/g, '')
                                .replace(/^\s*\} else assert\(.*\)$/g, '}')
                        )
                    }
                    if (!remote) {
                        sp = sp.map(line =>
                            line
                                .replace(/multi\.server instanceof RemoteServer/g, 'false')
                                .replace(/server instanceof RemoteServer/g, 'false')
                                .replace(/multi\.server instanceof PhysicsServer/g, 'multi.server')
                                .replace(/server instanceof PhysicsServer/g, 'multi.server')
                                .replace(/multi\.server instanceof PhysicsServer/g, 'multi.server')
                        )
                        if (!physics) throw new Error('cannot both disable remote and physics')
                    } else if (!physics) {
                        sp = sp.map(line =>
                            line
                                .replace(/multi\.server instanceof RemoteServer/g, 'multi.server')
                                .replace(/server instanceof RemoteServer/g, 'server')
                                .replace(/multi\.server instanceof PhysicsServer/g, 'false')
                                .replace(/server instanceof PhysicsServer/g, 'false')
                        )
                        if (!remote) throw new Error('cannot both disable remote and physics')
                    }

                    code = sp.join('\n')
                    return { contents: code, loader: 'default' }
                })
            }
        },
    }

    const ctx = await esbuild.context({
        entryPoints: ['./src/plugin.ts'],
        bundle: true,
        write: false,
        ...commonOptions,
        define: {
            PHYSICS: String(physics),
            PHYSICSNET: String(physicsnet),
            REMOTE: String(remote),
            BROWSER: String(browser),
        },
        plugins: [plugin],
    })

    if (type == 'build') {
        await ctx.rebuild()
        process.exit()
    } else {
        await ctx.watch()
    }
}

const args = process.argv.slice(2)
const obj = Object.fromEntries(
    args
        .filter(str => str.includes('='))
        .map(str => {
            const sp: any[] = str.split('=')
            if (sp[1] == 'false') sp[1] = false
            if (sp[1] == 'true') sp[1] = true
            return sp
        })
)

if (process.argv[2] == 'build') {
    await run('build', obj)
} else if (process.argv[2] == 'watch') {
    await run('watch', {})
}
