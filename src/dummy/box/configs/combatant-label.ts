import { prestart } from '../../../loading-stages'
import { PhysicsServer } from '../../../server/physics/physics-server'
import { addDummyBoxGuiConfig, disableSmallEntityBoxAdding } from '../configs'

declare global {
    namespace dummy {
        interface DummyPlayer {
            combatantLabelInfo?: {
                text: string
                time?: number
            }
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    sc.Combat.inject({
        showCombatantLabel(entity, msg) {
            if (!(multi.server instanceof PhysicsServer) || !(entity instanceof dummy.DummyPlayer))
                return this.parent(entity, msg)

            const { text, box } = disableSmallEntityBoxAdding(() => this.parent(entity, msg))
            if (text && box) {
                entity.combatantLabelInfo = {
                    text,
                    time: box.timer == 1 ? undefined : box.timer,
                }
            }
        },
    })
})

addDummyBoxGuiConfig({
    yPriority: 4,
    hideSmall: true,
    time: 1,
    condition: player => !!player.combatantLabelInfo,
    textGetter: player => player.combatantLabelInfo!.text,
    onCreate: (box, player) => {
        if (player.combatantLabelInfo!.time !== undefined) {
            box.timer = player.combatantLabelInfo!.time
        }
    },
    onRemove: player => {
        player.combatantLabelInfo = undefined
    },
})
