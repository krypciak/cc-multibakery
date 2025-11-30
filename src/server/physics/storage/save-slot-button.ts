import { prestart } from '../../../loading-stages'
import { type MultibakerySaveData } from './storage'

declare global {
    namespace sc {
        interface SaveSlotButton {
            multibakeryText: sc.TextGui
            multibakery?: MultibakerySaveData
        }
    }
}

prestart(() => {
    sc.SaveSlotButton.inject({
        init(save, slot) {
            this.multibakeryText = new sc.TextGui('\\i[multibakery-croissant]')
            this.multibakeryText.hook.transitions = {
                DEFAULT: { state: {}, time: 0, timeFunction: KEY_SPLINES.LINEAR },
                HIDDEN: { state: { alpha: 0 }, time: 0, timeFunction: KEY_SPLINES.LINEAR },
            }
            this.multibakeryText.hook.zIndex = 99999

            this.parent(save, slot)

            this.multibakeryText.setPos(129, 20)
            this.content.addChildGui(this.multibakeryText)
        },
        setSave(save, slot, skip) {
            this.parent(save, slot, skip)
            this.multibakery = save?.multibakery
            this.multibakeryText.doStateTransition(this.multibakery ? 'DEFAULT' : 'HIDDEN')
        },
    })
})
