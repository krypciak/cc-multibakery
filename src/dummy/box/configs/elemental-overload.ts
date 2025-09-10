import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface PlayerModel {
            showElementalOverloadLabel?: boolean
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    dummy.PlayerModel.inject({
        enterElementalOverload() {
            disableSmallEntityBoxAdding(() => this.parent())
            this.showElementalOverloadLabel = true
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 2,
    hideSmall: true,
    time: 1,
    condition: player => !!player.model.showElementalOverloadLabel,
    textGetter: _ => ig.lang.get('sc.gui.combat.element-overload'),
    onRemove: player => {
        player.model.showElementalOverloadLabel = undefined
    },
})
