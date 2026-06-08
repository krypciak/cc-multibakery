import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { isMissingFiles, generateBinaryTypes } from './generate-binary-encode-decode-scripts'
import { fileURLToPath } from 'url'

interface Options {
    sourcemap?: boolean
    physics?: boolean
    physicsnet?: boolean
    remote?: boolean
    browser?: boolean
    minifySyntax?: boolean
    minifyWhitespace?: boolean
    minifyIdentifiers?: boolean
    target?: string
    dropAssert?: boolean
    dev?: boolean
    dropProfiling?: boolean
    noWrite?: boolean
    forceRegenerateBinaryEncodeDecodeScripts?: boolean
    metafile?: boolean
    crossnode?: boolean
    test?: boolean
}

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function requireFix(code: string): string {
    code = code.replace(
        new RegExp(`import \\{\\s*([^}]*)\\s*\\} from "(.*)"`, 'g'),
        (_, imports, mod) => `var { ${imports.trim().replace(/\s+as\s+/g, ': ')} } = __require("${mod}")`
    )
    code = code.replace(new RegExp(`import \\* as (.*) from "(.*)"`, 'g'), `var $1 = __require("$2")`)
    code = code.replace(new RegExp(`import (.*) from "(.*)"`, 'g'), `var $1 = __require("$2")`)
    return code
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
        target = 'es2018',
        dropAssert = false,
        dev = true,
        dropProfiling = true,
        noWrite = false,
        forceRegenerateBinaryEncodeDecodeScripts = false,
        metafile = false,
        crossnode = false,
        test = false,
    }: Options
) {
    if (!physics) physicsnet = false

    const outputFile = `${projectRoot}/plugin.js`

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

    if (await isMissingFiles()) {
        await generateBinaryTypes(!dropAssert)
    }

    const plugin: esbuild.Plugin = {
        name: 'print',
        setup(build) {
            build.onStart(async () => {
                if (forceRegenerateBinaryEncodeDecodeScripts) {
                    await generateBinaryTypes(!dropAssert)
                }
            })

            build.onEnd(async res => {
                let output = res.outputFiles?.[0]?.text
                if (!output) return

                output = requireFix(output)

                if (noWrite) {
                    console.log(output)
                } else {
                    await fs.promises.writeFile(outputFile, output)
                }

                if (res.metafile) {
                    await fs.promises.writeFile(`${projectRoot}/metafile.json`, JSON.stringify(res.metafile))
                }

                if (!noWrite) {
                    const bytes = output.length
                    const kb = bytes / 1024
                    console.log(path.relative(projectRoot, outputFile), kb.toFixed(1) + 'kb')
                }
            })

            if (dropAssert || dropProfiling || !remote || !physics) {
                build.onLoad({ filter: /src.+\.(js|ts)$/ }, async args => {
                    let code = await fs.promises.readFile(args.path, 'utf8')
                    let sp = code.split('\n')
                    if (dropAssert) {
                        sp = sp.map(line =>
                            line
                                .replace(/^\s*(else )?(if \(.*\) )?assert(Physics|Remote)?\(.*\)$/g, '')
                                .replace(/^\s*\} else assert(Physics|Remote)?\(.*\)$/g, '}')
                        )
                    }
                    if (!remote) {
                        sp = sp.map(line =>
                            line
                                .replace(/multi\.server instanceof RemoteServer/g, 'false')
                                .replace(/server instanceof RemoteServer/g, 'false')
                                .replace(/isRemote\(multi\.server\)/g, 'false')
                                .replace(/isRemote\(server\)/g, 'false')

                                .replace(/multi\.server instanceof PhysicsServer/g, 'multi.server')
                                .replace(/server instanceof PhysicsServer/g, 'multi.server')
                                .replace(/isPhysics\(multi\.server\)/g, 'multi.server')
                                .replace(/isPhysics\(server\)/g, 'multi.server')
                        )
                        if (!physics) throw new Error('cannot both disable remote and physics')
                    } else if (!physics) {
                        sp = sp.map(line =>
                            line
                                .replace(/multi\.server instanceof RemoteServer/g, 'multi.server')
                                .replace(/server instanceof RemoteServer/g, 'server')
                                .replace(/isRemote\(multi\.server\)/g, 'multi.server')
                                .replace(/isRemote\(server\)/g, 'server')

                                .replace(/multi\.server instanceof PhysicsServer/g, 'false')
                                .replace(/server instanceof PhysicsServer/g, 'false')
                                .replace(/isPhysics\(multi\.server\)/g, 'false')
                                .replace(/isPhysics\(server\)/g, 'false')
                        )
                        if (!remote) throw new Error('cannot both disable remote and physics')
                    }

                    code = sp.join('\n')
                    return { contents: code, loader: 'default' }
                })
            }
        },
    }
    const external: string[] = []
    if (crossnode) external.push('ws')
    if (test) external.push('bun:test', '../../../crossnode/crossnode.js')

    const ctx = await esbuild.context({
        entryPoints: [`${projectRoot}/src/plugin.ts`],
        bundle: true,
        external,
        write: false,
        ...commonOptions,
        define: {
            PHYSICS: String(physics),
            PHYSICSNET: String(physicsnet),
            REMOTE: String(remote),
            BROWSER: String(browser),
            ASSERT: String(!dropAssert),
            DEV: String(dev),
            PROFILE: String(!dropProfiling),
            CROSSNODE: String(crossnode),
            TEST: String(test),
        },
        plugins: [plugin],
        metafile,
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
    await run('watch', obj)
}
