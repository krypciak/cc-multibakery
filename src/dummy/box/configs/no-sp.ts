import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface DummyPlayer {
            showNoSpLabel?: boolean
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    dummy.DummyPlayer.inject({
        startCharge(actionKey) {
            const { ret, text } = disableSmallEntityBoxAdding(() => this.parent(actionKey))
            if (text) this.showNoSpLabel = true
            return ret
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 3,
    hideSmall: true,
    time: 0.5,
    condition: player => !!player.showNoSpLabel,
    textGetter: _ => ig.lang.get('sc.gui.combat.no-sp'),
    onCreate: box => {
        if (ig.game.playerEntity) {
            ig.game.playerEntity.charging.msg = box
        }
    },
    onRemove: player => {
        player.showNoSpLabel = undefined
    },
})
