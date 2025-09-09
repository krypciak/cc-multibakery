import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface DummyPlayer {
            combatArtLabelTitle?: string
        }
    }
}

prestart(() => {
    dummy.DummyPlayer.inject({
        handleStateStart(state, input) {
            const { text } = disableSmallEntityBoxAdding(() => this.parent(state, input))
            if (text) this.combatArtLabelTitle = text
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 1,
    hideSmall: true,
    time: 1,
    condition: player => !!player.combatArtLabelTitle,
    textGetter: player => player.combatArtLabelTitle,
    onCreate: box => box.stopRumble(),
    onRemove: player => {
        player.combatArtLabelTitle = undefined
    },
})
