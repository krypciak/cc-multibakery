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

        modWhitelist: ['cc-multibakery', 'cc-instanceinator', 'ccmodmanager', 'nax-ccuilib', 'cc-krypek-lib', 'cc-variable-charge-time'],
        extensionWhitelist: [],
    })
}
