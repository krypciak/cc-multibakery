import { DummyBoxGuiConfig } from './box-addon'

import './configs/username'
import './configs/combat-art'
import './configs/elemental-overload'
import './configs/no-sp'
import './configs/menu'

let dummyBoxGuiConfigs: DummyBoxGuiConfig[]

export function getDummyBoxGuiConfigs(): DummyBoxGuiConfig[] {
    return dummyBoxGuiConfigs
}

export function addDummyBoxGuiConfig(config: DummyBoxGuiConfig) {
    dummyBoxGuiConfigs ??= []
    dummyBoxGuiConfigs.push(config)
}

export function disableSmallEntityBoxAdding<T>(func: () => T): { ret: T; text?: string } {
    const backup = ig.gui.addGuiElement
    let text
    ig.gui.addGuiElement = gui => {
        if (gui instanceof sc.SmallEntityBox) {
            text = gui.textGui.text?.toString()
        } else {
            backup.call(ig.gui, gui)
        }
    }
    const ret = func()
    ig.gui.addGuiElement = backup

    return { ret, text }
}
