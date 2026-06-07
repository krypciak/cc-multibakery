import { startCrossnode } from '../../../crossnode/crossnode.js'

let setupCrosscodePromise: Promise<void> | undefined
export async function setupCrosscodeIfNeeded() {
    if (setupCrosscodePromise) return setupCrosscodePromise
    return (setupCrosscodePromise = setupCrosscode())
}

async function setupCrosscode() {
    await startCrossnode({
        ccloader2: true,
        nukeImageStack: true,
        // writeImage: true,
        // writeImageInstanceinator: true,

        modWhitelist: ['cc-multibakery', 'cc-instanceinator', 'ccmodmanager', 'nax-ccuilib', 'cc-krypek-lib'],
        extensionWhitelist: [],
    })
}
