import { prestart } from '../../../loading-stages'
import type { DummyBoxGuiConfig } from '../box-addon'
import { disableSmallEntityBoxAdding } from '../disable-box-adding'

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

export const config: DummyBoxGuiConfig = {
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
}
