import './test-bridge'

let setupCrosscodePromise: Promise<void> | undefined
export async function setupCrosscodeIfNeeded() {
    if (setupCrosscodePromise) return setupCrosscodePromise
    return (setupCrosscodePromise = setupCrosscode())
}

async function setupCrosscode() {
    if (global.window) return

    const { startCrossnode } = await import('../../../crossnode/crossnode.js')
    await startCrossnode({
        ccloader2: true,
        nukeImageStack: true,
        // writeImage: true,
        // writeImageInstanceinator: true,

        modWhitelist: [
            'cc-multibakery',
            'cc-instanceinator',
            'cc-krypek-lib',
            'ccmodmanager',
            'nax-ccuilib',

            'cc-multibakery-additions',
            'cc-variable-charge-time',

            'xenons-playable-classes',
            'menu-ui-replacer',
            'extension-asset-preloader',
            'extendable-severed-heads',
            'cc-alybox',
        ],
        extensionWhitelist: ['post-game'],
    })
}
