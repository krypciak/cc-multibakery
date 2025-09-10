import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface DummyPlayer {
            combatArtLabelText?: string
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    dummy.DummyPlayer.inject({
        handleStateStart(state, input) {
            const { text } = disableSmallEntityBoxAdding(() => this.parent(state, input))
            if (text) this.combatArtLabelText = text
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 1,
    hideSmall: true,
    time: 1,
    condition: player => !!player.combatArtLabelText,
    textGetter: player => player.combatArtLabelText,
    onCreate: box => box.stopRumble(),
    onRemove: player => {
        player.combatArtLabelText = undefined
    },
})
