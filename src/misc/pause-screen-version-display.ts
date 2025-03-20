import Multibakery, { prestart } from '../plugin'

declare global {
    namespace sc {
        interface PauseScreenGui {
            multicroissantVersionGui: sc.TextGui
        }
    }
}
prestart(() => {
    sc.PauseScreenGui.inject({
        init(...args) {
            this.parent(...args)

            const gui = new sc.TextGui(`multibakery v${Multibakery.mod.version?.toString()}`, {
                font: sc.fontsystem.tinyFont,
            })
            gui.setAlign(this.versionGui.hook.align.x, this.versionGui.hook.align.y)
            const y =
                this.versionGui.hook.size.y + this.versionGui.hook.children.reduce((acc, gui) => acc + gui.size.y, 0)
            gui.setPos(0, y)
            gui.hook.transitions['HIDDEN'] = { state: { alpha: 0 }, time: 0, timeFunction: KEY_SPLINES.LINEAR }
            this.multicroissantVersionGui = gui
            this.versionGui.addChildGui(gui)
        },
        doStateTransition(name, skipTransition, removeAfter, callback, initDelay) {
            this.parent(name, skipTransition, removeAfter, callback, initDelay)
            if (name == 'DEFAULT') {
                if (multi.server) {
                    this.multicroissantVersionGui.doStateTransition('DEFAULT')
                } else {
                    this.multicroissantVersionGui.doStateTransition('HIDDEN', true)
                }
            }
        },
    })
})
