import { DummyBoxGuiConfig } from './box-addon'

import './configs/username'
import './configs/combat-art'
import './configs/elemental-overload'
import './configs/menu'

let dummyBoxGuiConfigs: DummyBoxGuiConfig[]

export function getDummyBoxGuiConfigs(): DummyBoxGuiConfig[] {
    return dummyBoxGuiConfigs
}

export function addDummyBoxGuiConfig(config: DummyBoxGuiConfig) {
    dummyBoxGuiConfigs ??= []
    dummyBoxGuiConfigs.push(config)
}

export function disableAddGuiElement(func: () => void) {
    const backup = ig.gui.addGuiElement
    ig.gui.addGuiElement = () => {}
    func()
    ig.gui.addGuiElement = backup
}
