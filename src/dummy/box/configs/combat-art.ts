import { prestart } from '../../../loading-stages'
import { addDummyBoxGuiConfig, disableAddGuiElement } from '../configs'

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
            disableAddGuiElement(() => this.parent(state, input))

            if (state.startState == 5) {
                const actionName = this.getChargeAction(
                    this.charging.type,
                    state.applyCharge
                ) as keyof typeof sc.PLAYER_ACTION
                if (!actionName) return

                this.combatArtLabelTitle = this.model.getCombatArtName(sc.PLAYER_ACTION[actionName]).value
            }
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
