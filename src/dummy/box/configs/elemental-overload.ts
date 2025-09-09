import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface PlayerModel {
            elementalOverloadLabelTitle?: string
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    dummy.PlayerModel.inject({
        enterElementalOverload() {
            const { text } = disableSmallEntityBoxAdding(() => this.parent())
            this.elementalOverloadLabelTitle = text
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
