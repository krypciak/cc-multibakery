import Multibakery from '../plugin'

const assets: Record<string, string> = {}
const everAdded: Set<string> = new Set()

export function addRuntimeAsset(dest: string, from: string) {
    assets[dest] = from
    everAdded.add(dest)
}

export function reloadRuntimeAssets() {
    if (Multibakery.mod.isCCL3) {
        for (const asset of everAdded) {
            ccmod.resources.assetOverridesTable.delete(asset)
        }
        Object.entries(assets).forEach(([k, v]) => {
            ccmod.resources.assetOverridesTable.set(k, v)
        })
    } else {
        Multibakery.mod.runtimeAssets = assets
    }
}
