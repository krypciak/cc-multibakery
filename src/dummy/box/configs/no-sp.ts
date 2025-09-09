import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface DummyPlayer {
            noSpLabel?: string
        }
    }
}

prestart(() => {
    dummy.DummyPlayer.inject({
        startCharge(actionKey) {
            const { ret, text } = disableSmallEntityBoxAdding(() => this.parent(actionKey))
            if (text) this.noSpLabel = text
            return ret
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 3,
    hideSmall: true,
    time: 0.5,
    condition: player => !!player.noSpLabel,
    textGetter: player => player.noSpLabel,
    onCreate: box => {
        if (ig.game.playerEntity) {
            ig.game.playerEntity.charging.msg = box
        }
    },
    onRemove: player => {
        player.noSpLabel = undefined
    },
})
