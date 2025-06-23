import { prestart } from '../../plugin'

declare global {
    namespace sc {
        interface TitleScreenButtonGui {
            serverListButton: sc.ButtonGui
        }
    }
}
prestart(() => {
    if (!REMOTE) return

    sc.TitleScreenButtonGui.inject({
        init() {
            this.parent()

            // Get the first button in the second column so we can position our button above it.
            const lastButton = this.buttonGroup.elements[1].find(Boolean)!.hook

            this.serverListButton = new sc.ButtonGui('Server list', lastButton.size.x)
            this.serverListButton.setAlign(lastButton.align.x, lastButton.align.y)
            this.serverListButton.setPos(lastButton.pos.x, lastButton.pos.y + 28)

            this.serverListButton.hook.transitions = lastButton.transitions
            this.serverListButton.doStateTransition('HIDDEN', true)

            this.buttonGroup.insertFocusGui(this.serverListButton, 1, 0)
            this.insertChildGui(this.serverListButton, 0)

            this.serverListButton.onButtonPress = () => {
                sc.menu.setDirectMode(true, sc.MENU_SUBMENU.MULTIBAKERY_LOGIN)
                sc.model.enterMenu(true)
            }
        },
        show() {
            this.parent()
            this.serverListButton.doStateTransition('DEFAULT')
        },
        hide(skipTransition) {
            this.parent(skipTransition)
            this.serverListButton.doStateTransition('HIDDEN', skipTransition)
        },
    })
})
