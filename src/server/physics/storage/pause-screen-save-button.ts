import { prestart } from '../../../loading-stages'
import { isPhysics } from '../is-physics-server'

prestart(() => {
    function updateButton(button: sc.ButtonGui) {
        if (!multi.server) return

        const active =
            isPhysics(multi.server) &&
            multi.server.settings.save?.manualSaving &&
            (ig.ccmap || ig.client == multi.server.getMasterClient())

        button.setActive(!!active)
    }
    sc.PauseScreenGui.inject({
        updateButtons(refocus) {
            this.parent(refocus)
            updateButton(this.saveGameButton)
        },
    })
    sc.StartMenu.inject({
        showMenu() {
            this.parent()
            updateButton(this.buttons.save)
        },
    })
})
