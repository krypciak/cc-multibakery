import Multibakery, { prestart } from '../plugin'
import { assert } from './assert'

declare global {
    namespace sc {
        interface PauseScreenGui {
            multicroissantVersionGui: sc.TextGui
        }
    }
}
prestart(() => {
    /* mod version */
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
declare global {
    namespace sc {
        interface PauseScreenGui {
            toTitleButtonBackup?: {
                text: string
                onButtonPress: () => void
            }
        }
    }
}
prestart(() => {
    /* change buttons */
    sc.PauseScreenGui.inject({
        doStateTransition(...args) {
            this.parent(...args)
            if (multi.server) {
                this.toTitleButtonBackup = {
                    text: this.toTitleButton.text!.toString(),
                    onButtonPress: this.toTitleButton.onButtonPress,
                }
                this.toTitleButton.setText('Leave server', true)
                this.toTitleButton.onButtonPress = () => {
                    ig.canLeavePauseMenu = false
                    sc.Dialogs.showYesNoDialog('Leave the server? \\c[0]', sc.DIALOG_INFO_ICON.QUESTION, button => {
                        ig.canLeavePauseMenu = true
                        if (button.data == 0) {
                            ig.interact.removeEntry(this.buttonInteract)
                            assert(ig.client)
                            multi.server.leaveClient(ig.client).then(() => {
                                ig.system.startRunLoop()
                            })
                        }
                    })
                }
            } else if (this.toTitleButtonBackup) {
                this.toTitleButton.setText(this.toTitleButtonBackup.text)
                this.toTitleButton.onButtonPress = this.toTitleButtonBackup.onButtonPress
                this.toTitleButtonBackup = undefined
            }
        },
    })
})
