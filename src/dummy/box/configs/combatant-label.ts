import { runTasks } from 'cc-instanceinator/src/inst-util'
import { prestart } from '../../../loading-stages'
import { isPhysics } from '../../../server/physics/physics-server-types'
import type { DummyBoxGuiConfig } from '../box-addon'
import { disableSmallEntityBoxAdding } from '../disable-box-adding'

declare global {
    namespace ig.ENTITY {
        interface Combatant {
            combatantLabelInfo?: {
                text: string
                time?: number
                align?: keyof typeof sc.SMALL_BOX_ALIGN
                offY?: number
            }
        }
    }
}

prestart(() => {
    if (!PHYSICS) return

    function getAlignType(align: sc.SmallBoxAlign): keyof typeof sc.SMALL_BOX_ALIGN {
        return align == sc.SMALL_BOX_ALIGN.BOTTOM ? 'BOTTOM' : align == sc.SMALL_BOX_ALIGN.CENTER ? 'CENTER' : 'TOP'
    }
    sc.Combat.inject({
        showCombatantLabel(entity, msg) {
            if (!isPhysics(multi.server)) return this.parent(entity, msg)

            const { text, box } = disableSmallEntityBoxAdding(() => this.parent(entity, msg))
            if (text && box) {
                const time = box.timer == 1 ? undefined : box.timer
                const offY = box.offY
                entity.combatantLabelInfo = {
                    text,
                    time,
                    align: getAlignType(box.align),
                    offY,
                }

                if (!(entity instanceof dummy.DummyPlayer)) {
                    runTasks(ig.mapShared.ccmap.getClientInstances(true), () => {
                        const newBox = new sc.SmallEntityBox(entity, text, time || 1, box.align, offY)
                        ig.gui.addGuiElement(newBox)
                    })
                }
            }
        },
    })
})

export const config: DummyBoxGuiConfig = {
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
}
