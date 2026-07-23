export interface ModVersionEntry {
    id: string
    version: string
}
export function isModVersionEntry(data: unknown): data is ModVersionEntry {
    if (!data || typeof data !== 'object') return false
    if (!('id' in data) || typeof data.id !== 'string') return false
    if (!('version' in data) || typeof data.version !== 'string') return false
    return true
}
export type AddonId =
    | 'fish-gear'
    | 'flying-hedgehag'
    | 'snowman-tank'
    | 'scorpion-robo'
    | 'post-game'
    | 'ninja-skin'
    | 'manlea'

export interface ModCompatibilityList {
    required: ModVersionEntry[]
    incompatible: ModVersionEntry[]
    ccuilibWidgets: string[]
    requiredAddons: AddonId[]
}
export function isModCompatibilityList(data: unknown): data is ModCompatibilityList {
    if (!data || typeof data !== 'object') return false
    if (!('required' in data) || !Array.isArray(data.required) || data.required.some(e => !isModVersionEntry(e))) {
        return false
    }
    if (
        !('incompatible' in data) ||
        !Array.isArray(data.incompatible) ||
        data.incompatible.some(e => !isModVersionEntry(e))
    ) {
        return false
    }
    if (!('ccuilibWidgets' in data) || !Array.isArray(data.ccuilibWidgets)) return false
    if (!('requiredAddons' in data) || !Array.isArray(data.requiredAddons)) return false

    return true
}
