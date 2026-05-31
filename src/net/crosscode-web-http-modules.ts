import type { RequestListener } from 'http'
import { assert } from '../misc/assert'

export interface CrosscodeWebModuleOptions {
    httpRoot?: string
    modProxy?: boolean
    liveModUpdates?: boolean
}

export async function getCrosscodeWebHttpModules(options: CrosscodeWebModuleOptions = {}) {
    const promises: Promise<RequestListener>[] = []
    if (options.modProxy) promises.push(modProxy())
    if (options.liveModUpdates) promises.push(liveModUpdates())
    if (options.httpRoot) promises.push(fsProxy(options.httpRoot))

    return Promise.all(promises)
}

async function fsProxy(httpRoot: string) {
    assert(PHYSICSNET)
    const fsProxy = PHYSICSNET && (await import('crosscode-web/src/http-server/http-module-fs'))
    fsProxy.setHttpRoot(httpRoot)

    return fsProxy.handleFunction
}

async function modProxy() {
    assert(PHYSICSNET)
    const modProxy = PHYSICSNET && (await import('crosscode-web/src/http-server/http-module-mod-proxy'))

    modProxy.setAllowedDbs([
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/stable',
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/testing',
        'https://raw.githubusercontent.com/krypciak/CCModDB/multi',
    ])

    await modProxy.updateValidUrlSet()

    return modProxy.handleFunction
}

async function liveModUpdates() {
    assert(PHYSICSNET)
    const liveModUpdates = PHYSICSNET && (await import('crosscode-web/src/http-server/http-module-live-mod-updates'))

    const esTarget = 'es2024'
    const sourceMap = true
    const minifyWhitespace = false
    const minifySyntax = false

    const commonEsbuildOpts = [
        `--target=${esTarget}`,
        '--format=esm',
        '--platform=node',
        '--bundle',
        sourceMap ? '--sourcemap=inline' : undefined,
        `--minify-syntax=${minifySyntax}`,
        `--minify-whitespace=${minifyWhitespace}`,
        'src/plugin.ts',
    ].filter(Boolean) as string[]

    liveModUpdates.setModConfigs([
        {
            id: 'cc-multibakery',
            repoPath: './assets/mods/cc-multibakery',
            buildCmd: 'bun',
            buildArguments: [
                'build/build.ts',
                'build',
                `minifySyntax=${minifySyntax}`,
                `minifyWhitespace=${minifyWhitespace}`,
                'physics=false',
                'browser=true',
                `target=${esTarget}`,
                'extraTreeShaking=true',
                'noWrite=true',
                `sourcemap=${sourceMap}`,
            ],
        },
        {
            id: 'cc-instanceinator',
            repoPath: './assets/mods/cc-instanceinator',
            buildCmd: 'esbuild',
            buildArguments: commonEsbuildOpts,
        },
        {
            id: 'ccmodmanager',
            repoPath: './assets/mods/CCModManager',
            buildCmd: 'esbuild',
            buildArguments: commonEsbuildOpts,
        },
        {
            id: 'nax-ccuilib',
            repoPath: './assets/mods/nax-ccuilib',
            buildCmd: 'esbuild',
            buildArguments: commonEsbuildOpts,
        },
        {
            id: 'cc-krypek-lib',
            repoPath: './assets/mods/cc-krypek-lib',
            buildCmd: 'esbuild',
            buildArguments: commonEsbuildOpts,
        },
    ])

    liveModUpdates.startWatchingMods()

    return liveModUpdates.handleFunction
}
