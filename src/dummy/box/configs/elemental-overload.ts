import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableAddGuiElement } from '../configs'

declare global {
    namespace dummy {
        interface PlayerModel {
            elementalOverloadLabelTitle?: string
        }
    }
}

prestart(() => {
    dummy.PlayerModel.inject({
        enterElementalOverload() {
            disableAddGuiElement(() => this.parent())
            this.elementalOverloadLabelTitle = ig.lang.get('sc.gui.combat.element-overload')
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 2,
    hideSmall: true,
    time: 1,
    condition: player => !!player.model.elementalOverloadLabelTitle,
    textGetter: player => player.model.elementalOverloadLabelTitle,
    onRemove: player => {
        player.model.elementalOverloadLabelTitle = undefined
    },
})
