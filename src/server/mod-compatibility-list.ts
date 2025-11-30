import { InstanceinatorInstance } from 'cc-instanceinator/src/instance'
import { type MultiPageButtonGuiButtons } from '../client/menu/pause/server-manage-button'
import { COLOR, wrapColor } from '../misc/wrap-color'
import { semver } from '../misc/nwjs-version-popup'
import Multibakery from '../plugin'

export interface ModVersionEntry {
    id: string
    version: string
}
type AddonId =
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

const knownClientModsWithJson = ['menu-ui-replacer', 'extendable-severed-heads', 'bobrank', 'NamedSaves', 'xpc-litter']

function getActiveModList() {
    return Multibakery.mod.isCCL3
        ? [...modloader.loadedMods.values()].map(m => ({
              id: m.id,
              version: m.version?.toString() ?? '',
              assets: m.assets,
              // @ts-expect-error
              tags: m.tags as string[],
          }))
        : activeMods.map(m => ({
              id: m.name,
              version: m.version,
              assets: m.assets as string[],
              tags: m.tags,
          }))
}

export function getModCompatibilityList(): ModCompatibilityList {
    const allMods = getActiveModList()

    const modsWithJson = allMods
        .filter(m => !knownClientModsWithJson.includes(m.id))
        .filter(m => [...m.assets].find(a => a.includes('.json')))

    const widgetMods = allMods.filter(m => m.tags?.includes('widget'))

    const required = [...new Set([...modsWithJson, ...widgetMods])].map(m => ({
        id: m.id,
        version: m.version,
    }))

    const widgets = Object.keys(nax.ccuilib.QuickRingMenuWidgets.widgets).filter(k => !k.startsWith('dummy'))

    const addons: AddonId[] = (
        ['fish-gear', 'flying-hedgehag', 'scorpion-robo', 'snowman-tank', 'post-game'] as const
    ).filter(addonName => ig.extensions.enabled[addonName])

    return {
        required,
        incompatible: [],
        ccuilibWidgets: widgets,
        requiredAddons: addons,
    }
}

type ModCompatibilityErrorList = {
    missing?: { modId: string }[]
    versionMismatch?: {
        modId: string
        expected: string
        actual: string
    }[]
    incompatible?: { modId: string }[]
    missingAddons?: { addonId: string }[]
}

export function isModCompatibilityListSatisfied(list: ModCompatibilityList): {
    satisfied: boolean
    errors: ModCompatibilityErrorList
} {
    const allMods = getActiveModList()

    const errors: ModCompatibilityErrorList = {}

    for (const mod of list.required) {
        const localMod = allMods.find(m => m.id == mod.id)
        if (!localMod) {
            ;(errors.missing ??= []).push({ modId: mod.id })
            continue
        }
        const expVersion = mod.version
        const actualVersion = localMod.version
        if (semver.lt(actualVersion, expVersion)) {
            ;(errors.versionMismatch ??= []).push({ modId: mod.id, expected: expVersion, actual: actualVersion })
            continue
        }
    }

    for (const mod of list.incompatible) {
        const localMod = allMods.find(m => m.id == mod.id)
        if (localMod) {
            ;(errors.incompatible ??= []).push({ modId: mod.id })
        }
    }

    for (const addonId of list.requiredAddons) {
        if (!ig.extensions.enabled[addonId]) {
            ;(errors.missingAddons ??= []).push({ addonId: addonId })
        }
    }

    return {
        satisfied: Object.keys(errors).length == 0,
        errors,
    }
}

export function showModCompatibilityListPopup(errors: ModCompatibilityErrorList) {
    const buttons: MultiPageButtonGuiButtons = []
    buttons.push({
        name: 'Close',
        onPress() {
            popup.closeMenu()
        },
    })

    let text = ``
    if (errors.missing) {
        text += 'Missing mods:\n'
        text += errors.missing.map(({ modId }) => `- ${wrapColor(modId, COLOR.YELLOW)}`).join('\n')
        text += '\n'
    }
    if (errors.incompatible) {
        text += 'Incompatible mods:\n'
        text += errors.incompatible.map(({ modId }) => `- ${wrapColor(modId, COLOR.YELLOW)}`).join('\n')
    }
    if (errors.versionMismatch) {
        text += 'Mod version mismatches:\n'
        text += errors.versionMismatch
            .map(
                ({ modId, expected, actual }) =>
                    `- ${wrapColor(modId, COLOR.YELLOW)}: ` +
                    `server ${wrapColor('v' + expected, COLOR.YELLOW)}, ` +
                    `local ${wrapColor('v' + actual, COLOR.YELLOW)}`
            )
            .join('\n')
    }
    if (errors.missingAddons) {
        text += 'Missing game addons:\n'
        text += errors.missingAddons.map(({ addonId }) => `- ${wrapColor(addonId, COLOR.YELLOW)}`)
    }

    const popup = new modmanager.gui.MultiPageButtonBoxGui(448, 290, buttons)
    popup.hook.temporary = true
    popup.setContent(wrapColor('Server compatibility error!', COLOR.RED), [{ content: [text] }])

    popup.openMenu()
}

export function applyModCompatibilityList(inst: InstanceinatorInstance, list: ModCompatibilityList) {
    const qrmw = inst.nax!.ccuilib.QuickRingMenuWidgets
    const widgets = new Set(list.ccuilibWidgets)

    qrmw.widgets = Object.fromEntries(Object.entries(qrmw.widgets).filter(([k]) => widgets.has(k)))
}
