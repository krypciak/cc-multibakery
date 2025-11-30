import type { DummyBoxGuiConfig } from './box-addon'

import './configs/username'
import './configs/combat-art'
import './configs/elemental-overload'
import './configs/no-sp'
import './configs/combatant-label'
import './configs/menu'

let dummyBoxGuiConfigs: DummyBoxGuiConfig[]

export function getDummyBoxGuiConfigs(): DummyBoxGuiConfig[] {
    return dummyBoxGuiConfigs
}

export function addDummyBoxGuiConfig(config: DummyBoxGuiConfig) {
    dummyBoxGuiConfigs ??= []
    dummyBoxGuiConfigs.push(config)
}

export function disableSmallEntityBoxAdding<T>(func: () => T): { ret: T; text?: string; box?: sc.SmallEntityBox } {
    const backup = ig.gui.addGuiElement
    let text: string | undefined
    let box: sc.SmallEntityBox | undefined
    ig.gui.addGuiElement = gui => {
        if (gui instanceof sc.SmallEntityBox) {
            text = gui.textGui.text?.toString()
            box = gui
        } else {
            backup.call(ig.gui, gui)
        }
    }
    const ret = func()
    ig.gui.addGuiElement = backup

    return { ret, text, box }
}
