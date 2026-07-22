import { modMetadata } from '../mod-metadata'

const assets: Record<string, string> = {}
const everAdded: Set<string> = new Set()

export function addRuntimeAsset(dest: string, from: string) {
    assets[dest] = from
    everAdded.add(dest)
}
export function removeRuntimeAssert(path: string) {
    delete assets[path]
}

export function reloadRuntimeAssets() {
    if (modMetadata.mod.isCCL3) {
        for (const asset of everAdded) {
            ccmod.resources.assetOverridesTable.delete(asset)
        }
        Object.entries(assets).forEach(([k, v]) => {
            ccmod.resources.assetOverridesTable.set(k, v)
        })
    } else {
        modMetadata.mod.runtimeAssets = assets
    }
}
