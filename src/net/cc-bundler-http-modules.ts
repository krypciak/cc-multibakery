import type { HandleFunction } from 'cc-bundler/src/http-server/http-module-mod-proxy'
import { assert } from '../misc/assert'

export interface CCBundlerModuleOptions {
    modProxy?: boolean
    liveModUpdates?: boolean
}

export async function getCCBundlerHttpModules(options: CCBundlerModuleOptions = {}) {
    const promises: Promise<HandleFunction>[] = []
    if (options.modProxy) promises.push(modProxy())
    if (options.liveModUpdates) promises.push(liveModUpdates())

    return Promise.all(promises)
}

async function modProxy() {
    assert(PHYSICSNET)
    const modProxy = PHYSICSNET && (await import('cc-bundler/src/http-server/http-module-mod-proxy'))

    modProxy.setAllowedDbs([
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/stable',
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/testing',
    ])

    await modProxy.updateValidUrlSet()

    return modProxy.handleFunction
}

async function liveModUpdates() {
    assert(PHYSICSNET)
    const liveModUpdates = PHYSICSNET && (await import('cc-bundler/src/http-server/http-module-live-mod-updates'))

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
            id: 'cc-ts-template-esbuild',
            repoPath: './assets/mods/cc-ts-template-esbuild',
            buildCmd: 'esbuild',
            buildArguments: commonEsbuildOpts,
        },
    ])

    liveModUpdates.startWatchingMods()

    return liveModUpdates.handleFunction
}
